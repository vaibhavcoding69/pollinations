/**
 * Creates Nebius configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Nebius configuration for Portkey headers
 */
export function buildNebiusConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': 'https://api.studio.nebius.com/v1',
		'x-portkey-api-key': process.env.NEBIUS_API_KEY,
		'x-portkey-max-tokens': config.maxTokens || 8192,
		'x-portkey-temperature': config.temperature || 0.7,
	};
}