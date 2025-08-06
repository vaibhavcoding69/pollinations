import dotenv from "dotenv";
import debug from "debug";
import fetch from "node-fetch";

import { findModelByName } from "./models.js";
import {
	extractApiVersion,
	extractDeploymentName,
	extractResourceName,
	generatePortkeyHeaders,
} from "./portkeyUtils.js";
import {
    validateAndNormalizeMessages,
    cleanNullAndUndefined,
    ensureSystemMessage,
    generateRequestId,
    cleanUndefined,
    normalizeOptions,
    convertSystemToUserMessages,
} from "./textGenerationUtils.js";

dotenv.config();

export const log = debug("pollinations:portkey");
const errorLog = debug("pollinations:portkey:error");

export async function generateTextPortkey(messages, options = {}) {
    const { model, stream, ...restOptions } = options;
    const modelConfig = findModelByName(model);

    if (!modelConfig) {
        throw new Error(`Model not found: ${model}`);
    }

    const { portkey: portkeyConfig } = modelConfig;


    const requestBody = {
        model: modelConfig.aliases,
        messages,
        stream,
        ...restOptions,
    };

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.PORTKEY_API_KEY}`,
        ...generatePortkeyHeaders(portkeyConfig)
    };

    const response = await fetch(`${process.env.PORTKEY_GATEWAY_URL}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
    });

    if (stream) {
        return response.body;
    }

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`Portkey API error: ${response.status} ${response.statusText} ${errorText}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}
