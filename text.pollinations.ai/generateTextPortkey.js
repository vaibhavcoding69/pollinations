import dotenv from "dotenv";
import fetch from "node-fetch";
import debug from "debug";
import { findModelByName } from "./availableModels.js";
import { SYSTEM_PROMPTS } from "./systemPrompts.js";
import * as providers from "./providers/index.js";
import {
	validateAndNormalizeMessages,
	cleanNullAndUndefined,
	ensureSystemMessage,
	generateRequestId,
	normalizeOptions,
	convertSystemToUserMessages,
} from "./textGenerationUtils.js";
import { createSseStreamConverter } from "./sseStreamConverter.js";
import { sendTinybirdEvent } from "./observability/tinybirdTracker.js";

dotenv.config();

const log = debug("pollinations:portkey");
const errorLog = debug("pollinations:portkey:error");

const PORTKEY_ENDPOINT = `${process.env.PORTKEY_GATEWAY_URL || "http://localhost:8787"}/v1/chat/completions`;

/**
 * Model mapping from user-facing names to provider model names
 */
const MODEL_MAPPING = {
	// Azure OpenAI models
	"openai-fast": "gpt-4.1-nano",
	"openai": "gpt-4.1-nano",
	"openai-large": "azure-gpt-4.1",
	"openai-roblox": "gpt-4.1-nano",
	"openai-reasoning": "o3",
	searchgpt: "gpt-4o-mini-search-preview",
	"openai-audio": "gpt-4o-mini-audio-preview",
	// Azure Grok model
	grok: "azure-grok",
	// Cloudflare models
	llama: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
	"llama-roblox": "meta-llama/Meta-Llama-3.1-8B-Instruct-fast",
	"llama-fast-roblox": "@cf/meta/llama-3.2-11b-vision-instruct",
	llamascout: "@cf/meta/llama-4-scout-17b-16e-instruct",
	"deepseek-reasoning": "deepseek-ai/DeepSeek-R1-0528",
	phi: "phi-4-instruct",
	// Scaleway models
	"qwen-coder": "qwen2.5-coder-32b-instruct",
	mistral: "mistral-small-3.1-24b-instruct-2503",
	"mistral-roblox": "@cf/mistralai/mistral-small-3.1-24b-instruct",
	"mistral-nemo-roblox": "mistralai/Mistral-Nemo-Instruct-2407",
	// Intelligence.io models
	glm: "THUDM/glm-4-9b-chat",
	// Modal models
	hormoz: "Hormoz-8B",
	// DeepSeek models
	deepseek: "DeepSeek-V3-0324",
	// Custom endpoints
	elixposearch: "elixposearch-endpoint",
};

/**
 * Models that don't support system messages
 */
const NO_SYSTEM_MESSAGE_MODELS = ["openai-reasoning", "o4-mini", "deepseek-reasoning"];

/**
 * Generates Portkey headers based on provider configuration
 */
function generatePortkeyHeaders(model) {
	const { provider, providerConfig } = model;
	
	switch (provider) {
		case "azure":
			return providers.buildAzureConfig(providerConfig);
		case "cloudflare":
			return providers.buildCloudflareConfig(providerConfig);
		case "scaleway":
			return providers.buildScalewayConfig(providerConfig);
		case "mistral":
			return providers.buildMistralConfig(providerConfig);
		case "nebius":
			return providers.buildNebiusConfig(providerConfig);
		case "modal":
			return providers.buildModalConfig(providerConfig);
		case "openrouter":
			return providers.buildOpenRouterConfig(providerConfig);
		case "monoai":
			return providers.buildMonoAIConfig(providerConfig);
		case "deepseek":
			return providers.buildDeepSeekConfig(providerConfig);
		case "intelligence":
			return providers.buildIntelligenceConfig(providerConfig);
		case "vertex":
			return providers.buildVertexAIConfig(providerConfig);
		default:
			throw new Error(`Unknown provider: ${provider}`);
	}
}

/**
 * Count characters in messages for input validation
 */
function countMessageCharacters(messages) {
	return messages.reduce((total, message) => {
		if (typeof message.content === "string") {
			return total + message.content.length;
		}
		if (Array.isArray(message.content)) {
			return (
				total +
				message.content.reduce((sum, part) => {
					if (part.type === "text") {
						return sum + part.text.length;
					}
					return sum;
				}, 0)
			);
		}
		return total;
	}, 0);
}

/**
 * Simplified text generation using Portkey gateway
 */
export async function generateTextPortkey(messages, options = {}) {
	const startTime = Date.now();
	const requestId = generateRequestId();

	log(`[${requestId}] Starting simplified portkey generation request`, {
		timestamp: new Date().toISOString(),
		messageCount: messages?.length || 0,
		options,
	});

	let normalizedOptions;

	try {
		// Normalize options
		normalizedOptions = normalizeOptions(options, { model: "openai-fast" });

		// Find model configuration
		const modelConfig = findModelByName(normalizedOptions.model);
		if (!modelConfig) {
			throw new Error(`Model not found: ${normalizedOptions.model}`);
		}

		// Get mapped model name
		const providerModel = MODEL_MAPPING[normalizedOptions.model] || modelConfig.modelMapping;

		// Validate and normalize messages
		const validatedMessages = validateAndNormalizeMessages(messages);

		// Check if model supports system messages
		const supportsSystemMessages = !NO_SYSTEM_MESSAGE_MODELS.includes(normalizedOptions.model);

		// Process messages based on system message support
		let processedMessages;
		const defaultSystemPrompt = SYSTEM_PROMPTS[normalizedOptions.model] || null;
		
		if (supportsSystemMessages) {
			processedMessages = ensureSystemMessage(
				validatedMessages,
				normalizedOptions,
				defaultSystemPrompt,
			);
		} else {
			log(`[${requestId}] Model ${providerModel} doesn't support system messages, converting to user messages`);
			const messagesWithSystem = ensureSystemMessage(
				validatedMessages,
				normalizedOptions,
				defaultSystemPrompt,
			);
			processedMessages = convertSystemToUserMessages(messagesWithSystem);
		}

		// Check input character limits
		if (modelConfig.maxInputChars) {
			const totalChars = countMessageCharacters(processedMessages);
			if (totalChars > modelConfig.maxInputChars) {
				throw new Error(
					`Input text exceeds maximum length of ${modelConfig.maxInputChars} characters for model ${normalizedOptions.model} (current: ${totalChars})`
				);
			}
		}

		// Build request body
		const requestBody = cleanNullAndUndefined({
			model: providerModel,
			messages: processedMessages,
			temperature: normalizedOptions.temperature,
			top_p: normalizedOptions.top_p,
			presence_penalty: normalizedOptions.presence_penalty,
			frequency_penalty: normalizedOptions.frequency_penalty,
			stream: normalizedOptions.stream,
			seed: normalizedOptions.seed,
			max_tokens: normalizedOptions.maxTokens || modelConfig.maxTokens || (modelConfig.providerConfig && modelConfig.providerConfig.maxTokens),
			response_format: normalizedOptions.response_format || (normalizedOptions.jsonMode ? { type: "json_object" } : undefined),
			tools: normalizedOptions.tools,
			tool_choice: normalizedOptions.tool_choice,
			modalities: normalizedOptions.modalities,
			audio: normalizedOptions.audio,
		});

		// Apply model-specific fixes
		if (modelConfig.name === "grok" && requestBody.seed !== undefined) {
			log(`[${requestId}] Setting seed to null for grok model (was: ${requestBody.seed})`);
			requestBody.seed = null;
		}

		// Generate provider-specific headers
		const portkeyHeaders = generatePortkeyHeaders(modelConfig);

		// Prepare request headers
		const headers = {
			Authorization: `Bearer ${process.env.PORTKEY_API_KEY}`,
			"Content-Type": "application/json",
			...portkeyHeaders,
		};

		log(`[${requestId}] Making request to Portkey with model ${providerModel}`);

		// Make API request
		const response = await fetch(PORTKEY_ENDPOINT, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
		});

		// Handle streaming response
		if (normalizedOptions.stream) {
			log(`[${requestId}] Streaming response from Portkey API, status: ${response.status}`);

			if (!response.ok) {
				const errorText = await response.text();
				let errorDetails = null;
				try {
					errorDetails = JSON.parse(errorText);
				} catch (e) {
					errorDetails = errorText;
				}

				const error = new Error(`${response.status} ${response.statusText}`);
				error.status = response.status;
				error.details = errorDetails;
				error.model = providerModel;
				throw error;
			}

			return {
				id: `portkey-${requestId}`,
				object: "chat.completion.chunk",
				created: Math.floor(startTime / 1000),
				model: providerModel,
				stream: true,
				responseStream: response.body,
				choices: [{
					delta: { content: "" },
					finish_reason: null,
					index: 0,
				}],
			};
		}

		// Handle non-streaming response
		log(`[${requestId}] Received response from Portkey API`, {
			timestamp: new Date().toISOString(),
			status: response.status,
			statusText: response.statusText,
		});

		if (!response.ok) {
			const errorText = await response.text();
			let errorDetails = null;
			try {
				errorDetails = JSON.parse(errorText);
			} catch (e) {
				errorDetails = errorText;
			}

			const error = new Error(`${response.status} ${response.statusText}`);
			error.status = response.status;
			error.details = errorDetails;
			error.model = providerModel;
			throw error;
		}

		// Parse response
		const data = await response.json();
		const completionTime = Date.now() - startTime;
		const modelUsed = data.model || providerModel;

		log(`[${requestId}] Successfully generated text`, {
			timestamp: new Date().toISOString(),
			completionTimeMs: completionTime,
			modelUsed,
			usage: data.usage,
		});

		// Send telemetry to Tinybird
		const endTime = new Date();
		sendTinybirdEvent({
			startTime: new Date(startTime),
			endTime,
			requestId,
			model: normalizedOptions.model,
			modelUsed,
			duration: completionTime,
			status: "success",
			usage: data.usage,
			project: "text.pollinations.ai",
			environment: process.env.NODE_ENV || "production",
			...normalizedOptions.userInfo,
			user: normalizedOptions.userInfo?.username || normalizedOptions.userInfo?.userId || "anonymous",
			referrer: normalizedOptions.userInfo?.referrer || "unknown",
			organization: normalizedOptions.userInfo?.userId ? "pollinations" : undefined,
			tier: normalizedOptions.userInfo?.tier || "seed",
		}).catch((err) => {
			errorLog(`[${requestId}] Failed to send telemetry to Tinybird`, err);
		});

		// Ensure response has all expected fields
		return {
			...data,
			id: data.id || `portkey-${requestId}`,
			object: data.object || "chat.completion",
			created: data.created || Date.now(),
		};

	} catch (error) {
		errorLog(`[${requestId}] Error in text generation`, {
			timestamp: new Date().toISOString(),
			error: error.message,
			name: error.name,
			stack: error.stack,
			completionTimeMs: Date.now() - startTime,
		});

		// Send error telemetry to Tinybird
		const endTime = new Date();
		const completionTime = endTime.getTime() - startTime;
		sendTinybirdEvent({
			startTime: new Date(startTime),
			endTime,
			requestId,
			model: normalizedOptions?.model || options?.model || "unknown",
			duration: completionTime,
			status: "error",
			error,
			project: "text.pollinations.ai",
			environment: process.env.NODE_ENV || "production",
			user: normalizedOptions?.userInfo?.username || normalizedOptions?.userInfo?.userId || "anonymous",
			username: normalizedOptions?.userInfo?.username,
			referrer: normalizedOptions?.userInfo?.referrer || "unknown",
			organization: normalizedOptions?.userInfo?.userId ? "pollinations" : undefined,
			tier: normalizedOptions?.userInfo?.tier || "seed",
		}).catch((err) => {
			errorLog(`[${requestId}] Failed to send error telemetry to Tinybird`, err);
		});

		throw error;
	}
}