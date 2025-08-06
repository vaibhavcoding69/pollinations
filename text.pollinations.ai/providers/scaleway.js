/**
 * Creates Scaleway configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Scaleway configuration for Portkey headers
 */
export function buildScalewayConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': config.customHost || process.env.SCALEWAY_BASE_URL || 'https://api.scaleway.com/ai-apis/v1',
		'x-portkey-api-key': config.apiKey || process.env.SCALEWAY_API_KEY,
		'x-portkey-max-tokens': config.maxTokens || 8192,
		'x-portkey-temperature': config.temperature || undefined,
	};
}

/**
 * Creates Mistral Scaleway configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Mistral Scaleway configuration for Portkey headers
 */
export function buildMistralConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': config.customHost || process.env.SCALEWAY_MISTRAL_BASE_URL,
		'x-portkey-api-key': config.apiKey || process.env.SCALEWAY_MISTRAL_API_KEY,
		'x-portkey-max-tokens': config.maxTokens || 8192,
		'x-portkey-temperature': config.temperature || 0.3,
	};
}