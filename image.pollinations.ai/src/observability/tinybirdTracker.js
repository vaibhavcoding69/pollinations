import dotenv from 'dotenv';
import debug from 'debug';
import { MODELS } from '../models.js';

/**
 * Get the provider name for a model 
 * @param {string} modelName - The name of the model
 * @returns {string} - The provider name based on model
 */
function getProviderNameFromModel(modelName) {
    const model = MODELS[modelName];
    return model?.provider || 'Unknown';
}

// Load environment variables
dotenv.config();

const log = debug('pollinations:tinybird');
const errorLog = debug('pollinations:tinybird:error');

const TINYBIRD_API_URL = process.env.TINYBIRD_API_URL || 'https://api.europe-west2.gcp.tinybird.co';
const TINYBIRD_API_KEY = process.env.TINYBIRD_API_KEY;

/**
 * Calculate cost for tile-based models (Flux, Turbo)
 * @param {Object} eventData - Event data containing image generation details
 * @returns {number} - Total cost in USD
 */
function calculateTileBasedCost(eventData) {
    const modelConfig = MODELS[eventData.model];
    if (!modelConfig?.pricing) {
        log(`No pricing configuration found for model: ${eventData.model}`);
        return 0;
    }
    
    const pricing = modelConfig.pricing;
    const imageParams = eventData.imageParams || {};
    
    // Get dimensions from the image parameters
    const width = imageParams.width || 1024;
    const height = imageParams.height || 1024;
    
    // Calculate number of tiles (512×512 each)
    const tiles = Math.ceil(width / pricing.tileSize) * Math.ceil(height / pricing.tileSize);
    
    // Get actual steps from imageParams - no fallback to defaultSteps
    const steps = imageParams.steps;
    if (steps === undefined || steps === null) {
        log(`Warning: No steps provided for ${eventData.model}, cost calculation may be inaccurate`);
        return 0; // Return 0 cost if steps not provided
    }
    
    // Calculate total cost
    const totalCost = (tiles * pricing.perTile) + (steps * pricing.perStep);
    
    log(`${eventData.model} cost calculation: ${width}×${height} = ${tiles} tiles, ${steps} steps, totalCost=$${totalCost.toFixed(6)}`);
    
    return totalCost;
}

/**
 * Calculate cost for Flux model based on tiles and steps
 * @param {Object} eventData - Event data containing image generation details
 * @returns {number} - Total cost in USD
 */
function calculateFluxCost(eventData) {
    return calculateTileBasedCost(eventData);
}

/**
 * Calculate cost for GPT-image-1 model based on image parameters
 * @param {Object} eventData - Event data containing image generation details
 * @returns {number} - Total cost in USD
 */
function calculateGptImageCost(eventData) {
    const { textTokens = 0, inImages = [], outImages = [], cached = false } = eventData.imageUsage || {};
    
    // Get pricing from models.js
    const modelConfig = MODELS[eventData.model];
    if (!modelConfig?.pricing) {
        log(`No pricing configuration found for model: ${eventData.model}`);
        return 0;
    }
    
    const pricing = modelConfig.pricing;
    
    // Pricing constants (USD per token)
    const PRICE_TEXT_IN = (cached ? pricing.textInputCached : pricing.textInput) / 1e6; // $/token
    const PRICE_IMG_IN = (cached ? pricing.imageInputCached : pricing.imageInput) / 1e6;
    const PRICE_IMG_OUT = pricing.imageOutput / 1e6;
    
    // Helper: calculate tokens for a single image
    const imgTokens = ({ w, h, detail = 'high' }) => {
        if (detail === 'low') return pricing.lowDetailTokens;
        // Mandatory resize (long ≤2048, short ≤768)
        const scale = Math.min(2048 / Math.max(w, h), 768 / Math.min(w, h), 1);
        const rw = Math.ceil(w * scale);
        const rh = Math.ceil(h * scale);
        const tiles = Math.ceil(rw / 512) * Math.ceil(rh / 512);
        return pricing.highDetailBaseTokens + pricing.highDetailTileTokens * tiles;
    };
    
    // Calculate token tallies
    const imgInTok = inImages.reduce((t, img) => t + imgTokens(img), 0);
    const imgOutTok = outImages.reduce((t, img) => t + imgTokens(img), 0);
    
    // Calculate total cost
    const totalCost = 
        textTokens * PRICE_TEXT_IN + 
        imgInTok * PRICE_IMG_IN + 
        imgOutTok * PRICE_IMG_OUT;
    
    log(`GPT-image-1 cost calculation: textTokens=${textTokens}, inImages=${inImages.length}, outImages=${outImages.length}, cached=${cached}, totalCost=$${totalCost.toFixed(6)}`);
    
    return totalCost;
}

/**
 * Send LLM call telemetry to Tinybird
 * @param {Object} eventData - The event data to send to Tinybird
 * @returns {Promise} - Promise that resolves when the event is sent
 */
export async function sendTinybirdEvent(eventData) {
    // Skip if Tinybird API key is not set - this is optional functionality
    if (!TINYBIRD_API_KEY) {
        log('TINYBIRD_API_KEY not set, skipping telemetry');
        return;
    }
    
    // Log the friendly model name we received
    log(`Sending telemetry to Tinybird for model: ${eventData.model || 'unknown'}`);

    try {
        // Simply reference cost components from the usage object directly
        // without transformations or data manipulation
        let totalCost = 0;
        
        // Check if this is an image model event
        if (eventData.eventType === 'image_generation') {
            const modelConfig = MODELS[eventData.model];
            
            if (!modelConfig?.pricing) {
                log(`No pricing configuration found for model: ${eventData.model}`);
                totalCost = 0;
            } else if (eventData.model === 'flux' || eventData.model === 'turbo') {
                // Both Flux and Turbo use tile and step-based pricing
                totalCost = calculateTileBasedCost(eventData);
            } else if (modelConfig.pricing.perImage !== undefined) {
                // Other models might use simple per-image pricing
                totalCost = modelConfig.pricing.perImage || 0;
                log(`Per-image pricing for ${eventData.model}: $${totalCost}${modelConfig.pricing.note ? ` (${modelConfig.pricing.note})` : ''}`);
            } else if (eventData.model === 'gptimage' || eventData.model === 'gpt-image-1') {
                // Token-based pricing for GPT-image-1
                totalCost = calculateGptImageCost(eventData);
            } else {
                log(`Unknown pricing model for: ${eventData.model}`);
                totalCost = 0;
            }
        } else {
            // For text models, we would need pricing info which we don't have here
            log(`Text model cost calculation not available in image service`);
            totalCost = 0;
        }

        // Get the provider for the model
        const modelName = eventData.model || 'unknown';
        const provider = getProviderNameFromModel(modelName);
        log(`Provider for model ${modelName}: ${provider}`);
        
        // Construct the event object with defaults and conditionals using spread operator
        const event = {
            // Standard timestamps and identifiers
            start_time: eventData.startTime?.toISOString(),
            end_time: eventData.endTime?.toISOString(),
            message_id: eventData.requestId,
            id: eventData.requestId,
            
            // Ensure response_id field is always present without intrusive data transformations
            
            // Model and provider info
            model: modelName,
            provider,
            
            // Performance metrics
            duration: eventData.duration,
            llm_api_duration_ms: eventData.duration,
            standard_logging_object_response_time: eventData.duration,
            
            // Cost information
            cost: totalCost,
            
            // User info
            user: eventData.username || eventData.user || 'anonymous',
            username: eventData.username,
            
            // Status and event type
            standard_logging_object_status: eventData.status,
            log_event_type: eventData.eventType || 'chat_completion',
            call_type: eventData.eventType === 'image_generation' ? 'image_generation' : 'completion',
            cache_hit: false,
            
            // Metadata
            proxy_metadata: {
                organization: eventData.organization || 'pollinations',
                project: eventData.project || 'text.pollinations.ai',
                environment: eventData.environment || process.env.NODE_ENV || 'development',
                chat_id: eventData.chatId || '',
                ...(eventData.eventType === 'image_generation' && {
                    image_params: eventData.imageParams || {}
                })
            },
            
            // Always include basic response object to prevent null response_id
            // For success cases, include full response data; for error cases, include minimal id
            response: eventData.status === 'success' ? {
                id: eventData.requestId,
                object: eventData.eventType === 'image_generation' ? 'image.generation' : 'chat.completion',
                // Pass the usage object directly without transformation
                usage: eventData.usage,
                // Include image-specific response data if available
                ...(eventData.eventType === 'image_generation' && eventData.imageResponse && {
                    images: eventData.imageResponse
                })
            } : {
                // Minimal response object for failed requests to satisfy schema
                id: eventData.requestId || `req_${Date.now()}`
            },
            
            // Conditionally add error info
            ...(eventData.status === 'error' && {
                exception: eventData.error?.message || 'Unknown error',
                traceback: eventData.error?.stack || '',
            }),
        };

        // Simplified user logging with a consistent format
        const userIdentifier = eventData.username ? 
            `Username: ${eventData.username}` : 
            eventData.user && eventData.user !== 'anonymous' ? 
                `UserID: ${eventData.user}` : 
                'Anonymous user';
            
        log(`Sending telemetry to Tinybird for ${eventData.model} call - ${userIdentifier}${eventData.tier ? `, Tier: ${eventData.tier}` : ''}`);
        
        // Create an abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);  // 5 second timeout
        
        try {
            const response = await fetch(`${TINYBIRD_API_URL}/v0/events?name=llm_events`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TINYBIRD_API_KEY}`,
                },
                body: JSON.stringify(event),
                signal: controller.signal
            });

            const responseText = await response.text().catch(() => 'Could not read response text');
            
            if (!response.ok) {
                errorLog(`Failed to send telemetry to Tinybird: ${response.status} ${responseText}`);
            } else {
                log(`Tinybird response: ${response.status} ${responseText}`);
                log(`Successfully sent telemetry event for model: ${modelName}, provider: ${provider}`);
            }
        } catch (fetchError) {
            const errorMessage = fetchError.name === 'AbortError' ? 
                'Tinybird telemetry request timed out after 5 seconds' : 
                `Fetch error when sending telemetry to Tinybird: ${fetchError.message}`;
            errorLog(errorMessage);
        } finally {
            clearTimeout(timeoutId);
        }
    } catch (error) {
        errorLog('Error sending telemetry to Tinybird: %O', error);
    }
}
