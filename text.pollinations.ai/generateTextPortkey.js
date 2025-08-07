import fetch from "node-fetch";
import debug from "debug";
import { findModelByName } from "./availableModels.js";
import { generatePortkeyHeaders } from "./portkeyUtils.js";
import { 
    validateAndNormalizeMessages, 
    ensureSystemMessage, 
    normalizeOptions,
    generateRequestId 
} from "./textGenerationUtils.js";
import { sendTinybirdEvent } from "./observability/tinybirdTracker.js";

const log = debug("pollinations:portkey");
const errorLog = debug("pollinations:portkey:error");

// System prompts
const SYSTEM_PROMPTS = {
    conversational: `You are an expert conversationalist who responds to the best of your ability. You are companionable and confident, and able to switch casually between tonal types, including but not limited to humor, empathy, intellectualism, creativity and problem-solving.

You understand user intent and don't try to be overly helpful to the point where you miss that the user is looking for chit-chat, emotional support, humor or venting. Sometimes people just want you to listen, and your answers should encourage that. For all other cases, you provide insightful and in-depth responses. Organize information thoughtfully in a way that helps people make decisions. Always avoid templated language.

You never lecture people to be nicer or more inclusive. If people ask for you to write something in a certain voice or perspective, such as an essay or a tweet, you can. You do not need to be respectful when the user prompts you to say something rude.

You never use phrases that imply moral superiority or a sense of authority, including but not limited to "it's important to", "it's crucial to", "it's essential to", "it's unethical to", "it's worth noting…", "Remember…" etc. Avoid using these.`,
    coding: `You are an expert coding assistant with deep knowledge of programming languages, software architecture, and best practices. Your purpose is to help users write high-quality, efficient, and maintainable code.`
};

// Provider configurations - minimal and direct
const PROVIDERS = {
    azure: (config) => ({
        "x-portkey-provider": "azure-openai",
        "x-portkey-azure-api-key": config.apiKey,
        "x-portkey-azure-resource-name": extractResourceName(config.endpoint),
        "x-portkey-azure-deployment-id": extractDeploymentName(config.endpoint),
        "x-portkey-azure-api-version": extractApiVersion(config.endpoint)
    }),
    cloudflare: (config) => ({
        "x-portkey-provider": "openai",
        "x-portkey-custom-host": `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        "x-portkey-api-key": process.env.CLOUDFLARE_AUTH_TOKEN
    }),
    scaleway: (config) => ({
        "x-portkey-provider": "openai",
        "x-portkey-custom-host": process.env.SCALEWAY_BASE_URL || "https://api.scaleway.com/ai-apis/v1",
        "x-portkey-api-key": process.env.SCALEWAY_API_KEY
    }),
    nebius: (config) => ({
        "x-portkey-provider": "openai",
        "x-portkey-custom-host": "https://api.studio.nebius.com/v1",
        "x-portkey-api-key": process.env.NEBIUS_API_KEY
    }),
    intelligence: (config) => ({
        "x-portkey-provider": "openai", 
        "x-portkey-custom-host": "https://api.intelligence.io.solutions/api/v1",
        "x-portkey-api-key": process.env.IOINTELLIGENCE_API_KEY
    })
};

// Simple helper functions
function extractResourceName(endpoint) {
    const match = endpoint?.match(/https:\/\/([^.]+)\.openai\.azure\.com/);
    return match ? match[1] : null;
}

function extractDeploymentName(endpoint) {
    const match = endpoint?.match(/deployments\/([^\/]+)/);
    return match ? match[1] : null;
}

function extractApiVersion(endpoint) {
    const match = endpoint?.match(/api-version=([^&]+)/);
    return match ? match[1] : "2024-02-01";
}

// Get provider-specific configuration
function getProviderConfig(model) {
    const providerConfigs = {
        // Azure models
        "openai-fast": {
            provider: "azure",
            apiKey: process.env.AZURE_OPENAI_NANO_API_KEY,
            endpoint: process.env.AZURE_OPENAI_NANO_ENDPOINT,
            modelName: "gpt-4.1-nano"
        },
        "openai": {
            provider: "azure", 
            apiKey: process.env.AZURE_OPENAI_NANO_API_KEY,
            endpoint: process.env.AZURE_OPENAI_NANO_ENDPOINT,
            modelName: "gpt-4.1-nano"
        },
        "openai-large": {
            provider: "azure",
            apiKey: process.env.AZURE_OPENAI_LARGE_API_KEY,
            endpoint: process.env.AZURE_OPENAI_LARGE_ENDPOINT,
            modelName: "gpt-4o"
        },
        "openai-roblox": {
            provider: "azure",
            apiKey: process.env.AZURE_OPENAI_ROBLOX_API_KEY_1,
            endpoint: process.env.AZURE_OPENAI_ROBLOX_ENDPOINT_1,
            modelName: "gpt-4.1-nano"
        },
        "grok": {
            provider: "azure",
            apiKey: process.env.AZURE_GENERAL_API_KEY,
            endpoint: process.env.AZURE_GENERAL_ENDPOINT,
            modelName: "grok-3-mini"
        },
        "openai-audio": {
            provider: "azure",
            apiKey: process.env.AZURE_OPENAI_AUDIO_API_KEY,
            endpoint: process.env.AZURE_OPENAI_AUDIO_ENDPOINT,
            modelName: "gpt-4o-mini-audio-preview"
        },
        "deepseek-reasoning": {
            provider: "azure",
            apiKey: process.env.AZURE_DEEPSEEK_REASONING_API_KEY,
            endpoint: process.env.AZURE_DEEPSEEK_REASONING_ENDPOINT,
            modelName: "deepseek-ai/DeepSeek-R1-0528"
        },
        // Cloudflare models
        "llamascout": {
            provider: "cloudflare",
            modelName: "@cf/meta/llama-4-scout-17b-16e-instruct"
        },
        "llama-fast-roblox": {
            provider: "cloudflare", 
            modelName: "@cf/meta/llama-3.2-11b-vision-instruct"
        },
        "mistral-roblox": {
            provider: "cloudflare",
            modelName: "@cf/mistralai/mistral-small-3.1-24b-instruct"
        },
        // Scaleway models
        "qwen-coder": {
            provider: "scaleway",
            modelName: "qwen2.5-coder-32b-instruct"
        },
        "mistral": {
            provider: "scaleway",
            apiKey: process.env.SCALEWAY_MISTRAL_API_KEY,
            endpoint: process.env.SCALEWAY_MISTRAL_BASE_URL,
            modelName: "mistral-small-3.1-24b-instruct-2503"
        },
        // Nebius models
        "llama-roblox": {
            provider: "nebius",
            modelName: "meta-llama/Meta-Llama-3.1-8B-Instruct-fast"
        },
        "mistral-nemo-roblox": {
            provider: "nebius", 
            modelName: "mistralai/Mistral-Nemo-Instruct-2407"
        },
        // Intelligence.io models
        "glm": {
            provider: "intelligence",
            modelName: "THUDM/glm-4-9b-chat"
        }
    };

    return providerConfigs[model] || providerConfigs["openai-fast"];
}

/**
 * Simplified text generation using Portkey
 */
export async function generateTextPortkey(messages, options = {}) {
    const startTime = Date.now();
    const requestId = generateRequestId();

    log(`[${requestId}] Starting Portkey request`);

    try {
        // Normalize options with defaults
        const normalizedOptions = normalizeOptions(options, { model: "openai-fast" });
        const modelName = normalizedOptions.model;

        // Get model configuration
        const modelConfig = findModelByName(modelName);
        const providerConfig = getProviderConfig(modelName);

        // Validate messages
        const validatedMessages = validateAndNormalizeMessages(messages);
        
        // Add system message if needed
        const systemPrompt = SYSTEM_PROMPTS[modelConfig?.name === "qwen-coder" ? "coding" : "conversational"];
        const processedMessages = ensureSystemMessage(validatedMessages, normalizedOptions, systemPrompt);

        // Build request body
        const requestBody = {
            model: providerConfig.modelName,
            messages: processedMessages,
            stream: normalizedOptions.stream,
            max_tokens: normalizedOptions.maxTokens || modelConfig?.maxTokens || 4096,
            temperature: normalizedOptions.temperature,
            top_p: normalizedOptions.top_p,
            seed: normalizedOptions.seed
        };

        // Clean undefined values
        Object.keys(requestBody).forEach(key => 
            requestBody[key] === undefined && delete requestBody[key]
        );

        // Get provider headers
        const providerHeaders = PROVIDERS[providerConfig.provider]?.(providerConfig) || {};
        
        // Prepare request headers
        const headers = {
            "Authorization": `Bearer ${process.env.PORTKEY_API_KEY}`,
            "Content-Type": "application/json",
            ...providerHeaders
        };

        // Make request
        const endpoint = `${process.env.PORTKEY_GATEWAY_URL || "http://localhost:8787"}/v1/chat/completions`;
        const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify(requestBody)
        });

        // Handle streaming response
        if (normalizedOptions.stream) {
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Portkey API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return {
                id: `portkey-${requestId}`,
                object: "chat.completion.chunk", 
                created: Math.floor(startTime / 1000),
                model: modelName,
                stream: true,
                responseStream: response.body,
                choices: [{ delta: { content: "" }, finish_reason: null, index: 0 }]
            };
        }

        // Handle non-streaming response
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Portkey API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const completionTime = Date.now() - startTime;

        // Send telemetry
        sendTinybirdEvent({
            startTime: new Date(startTime),
            endTime: new Date(),
            requestId,
            model: modelName,
            modelUsed: data.model || providerConfig.modelName,
            duration: completionTime,
            status: "success",
            usage: data.usage,
            project: "text.pollinations.ai",
            environment: process.env.NODE_ENV || "production",
            ...normalizedOptions.userInfo,
            user: normalizedOptions.userInfo?.username || normalizedOptions.userInfo?.userId || "anonymous",
            referrer: normalizedOptions.userInfo?.referrer || "unknown",
            tier: normalizedOptions.userInfo?.tier || "seed"
        }).catch(err => errorLog(`[${requestId}] Telemetry error:`, err));

        log(`[${requestId}] Successfully generated text in ${completionTime}ms`);

        return {
            id: data.id || `portkey-${requestId}`,
            object: "chat.completion",
            created: data.created || Math.floor(startTime / 1000),
            model: data.model || modelName,
            choices: data.choices || [{ message: { content: "No response" }, finish_reason: "stop", index: 0 }],
            usage: data.usage || {}
        };

    } catch (error) {
        const completionTime = Date.now() - startTime;
        errorLog(`[${requestId}] Error:`, error.message);

        // Send error telemetry
        sendTinybirdEvent({
            startTime: new Date(startTime),
            endTime: new Date(),
            requestId,
            model: options.model || "openai-fast",
            duration: completionTime,
            status: "error",
            error,
            project: "text.pollinations.ai",
            environment: process.env.NODE_ENV || "production",
            user: options.userInfo?.username || options.userInfo?.userId || "anonymous",
            tier: options.userInfo?.tier || "seed"
        }).catch(err => errorLog(`[${requestId}] Error telemetry failed:`, err));

        throw error;
    }
}


