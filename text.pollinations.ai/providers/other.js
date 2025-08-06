/**
 * Creates Modal configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Modal configuration for Portkey headers
 */
export function buildModalConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': 'https://pollinations--hormoz-serve.modal.run/v1',
		'x-portkey-api-key': process.env.HORMOZ_MODAL_KEY,
		'x-portkey-max-tokens': config.maxTokens || 4096,
	};
}

/**
 * Creates OpenRouter configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} OpenRouter configuration for Portkey headers
 */
export function buildOpenRouterConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': 'https://openrouter.ai/api/v1',
		'x-portkey-api-key': process.env.OPENROUTER_API_KEY,
		'x-portkey-max-tokens': config.maxTokens || 4096,
		'x-portkey-http-referer': 'https://pollinations.ai',
		'x-portkey-x-title': 'Pollinations.AI',
	};
}

/**
 * Creates MonoAI configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} MonoAI configuration for Portkey headers
 */
export function buildMonoAIConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': 'https://chatgpt.loves-being-a.dev/v1',
		'x-portkey-api-key': process.env.CHATWITHMONO_API_KEY,
	};
}

/**
 * Creates DeepSeek configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} DeepSeek configuration for Portkey headers
 */
export function buildDeepSeekConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': config.endpoint || process.env.AZURE_DEEPSEEK_V3_ENDPOINT,
		'x-portkey-api-key': config.apiKey || process.env.AZURE_DEEPSEEK_V3_API_KEY,
		'x-portkey-auth-header-name': 'Authorization',
		'x-portkey-auth-header-value-prefix': '',
		'x-portkey-max-tokens': config.maxTokens || 8192,
	};
}

/**
 * Creates Intelligence.io configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Intelligence.io configuration for Portkey headers
 */
export function buildIntelligenceConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': 'https://api.intelligence.io.solutions/api/v1',
		'x-portkey-api-key': process.env.IOINTELLIGENCE_API_KEY,
		'x-portkey-max-tokens': config.maxTokens || 8192,
		'x-portkey-temperature': config.temperature || 0.7,
	};
}

/**
 * Creates Vertex AI configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Vertex AI configuration for Portkey headers
 */
export function buildVertexAIConfig(config = {}) {
	return {
		'x-portkey-provider': 'vertex-ai',
		'x-portkey-vertex-project-id': process.env.GCLOUD_PROJECT_ID,
		'x-portkey-vertex-region': config.region || 'us-central1',
		'x-portkey-vertex-model-id': config.modelId,
		'x-portkey-strict-openai-compliance': 'false',
	};
}