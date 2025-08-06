/**
 * Creates Cloudflare Workers AI configuration for Portkey
 * @param {Object} config - Configuration object
 * @returns {Object} Cloudflare configuration for Portkey headers
 */
export function buildCloudflareConfig(config = {}) {
	return {
		'x-portkey-provider': 'openai',
		'x-portkey-custom-host': `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
		'x-portkey-api-key': process.env.CLOUDFLARE_AUTH_TOKEN,
		'x-portkey-max-tokens': config.maxTokens || 8192,
		'x-portkey-temperature': config.temperature || undefined,
	};
}