import { models } from './models.js';

// Use the models array directly without sorting
const unsortedModels = models;

// Define default pricing values
const DEFAULT_PRICING = { prompt: 1, completion: 4, cache: 0.25 };

// Set default pricing using functional approach
const modelsWithPricing = unsortedModels.map((model) => ({
	...model,
	pricing: {
		...DEFAULT_PRICING,
		...model.pricing,
	},
}));

// Now export the processed models with proper functional approach
export const availableModels = modelsWithPricing.map((model) => {
	const inputs = model.input_modalities || [];
	const outputs = model.output_modalities || [];

	return {
		...model,
		vision: inputs.includes("image"),
		audio: inputs.includes("audio") || outputs.includes("audio"),
	};
});

// Default pricing is now automatically applied to all models in the modelsWithPricing array

/**
 * Find a model by name
 * @param {string} modelName - The name of the model to find
 * @returns {Object|null} - The model object or null if not found
 */
export function findModelByName(modelName) {
	return (
		availableModels.find(
			(model) => model.name === modelName || model.aliases === modelName,
		) || availableModels.find((model) => model.name === "openai-fast")
	); // Default to openai
}

/**
 * Get a handler function for a specific model
 * @param {string} modelName - The name of the model
 * @returns {Function} - The handler function for the model, or the default handler if not found
 */
export function getHandler(modelName) {
	const model = findModelByName(modelName);
	return model.handler;
}

/**
 * Get all model names with their aliases
 * @returns {Object} - Object mapping primary model names to their aliases
 */
export function getAllModelAliases() {
	return availableModels.reduce((aliasMap, model) => {
		aliasMap[model.name] = model.aliases ? [model.aliases] : [];
		return aliasMap;
	}, {});
}
