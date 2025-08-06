import { extractApiVersion, extractDeploymentName, extractResourceName } from '../portkeyUtils.js';

/**
 * Creates Azure OpenAI configuration for Portkey
 * @param {Object} config - Configuration object
 * @param {string} config.apiKey - Azure API key
 * @param {string} config.endpoint - Azure endpoint
 * @param {string} config.deploymentId - Deployment ID
 * @param {string} [config.resourceName] - Resource name (extracted from endpoint if not provided)
 * @returns {Object} Azure configuration for Portkey headers
 */
export function buildAzureConfig(config) {
	const { apiKey, endpoint, deploymentId, resourceName } = config;
	
	return {
		'x-portkey-provider': 'azure-openai',
		'x-portkey-azure-api-key': apiKey,
		'x-portkey-azure-resource-name': resourceName || extractResourceName(endpoint),
		'x-portkey-azure-deployment-id': deploymentId || extractDeploymentName(endpoint),
		'x-portkey-azure-api-version': extractApiVersion(endpoint),
		'x-portkey-azure-model-name': deploymentId || extractDeploymentName(endpoint),
		'x-portkey-retry': '3',
	};
}