/**
 * Helicone Logger - Integration with self-hosted Helicone for LLM request tracking
 * 
 * This module provides functions to log both streaming and non-streaming LLM requests
 * to a self-hosted Helicone instance.
 */

import fetch from 'node-fetch';
import debug from 'debug';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const log = debug('pollinations:helicone');

// Configuration from environment variables
const HELICONE_API_KEY = process.env.HELICONE_API_KEY;
const HELICONE_API_ENDPOINT = process.env.HELICONE_API_ENDPOINT;
const HELICONE_ENABLED = String(process.env.HELICONE_ENABLED).toLowerCase() === 'true';

// Use the endpoint directly as provided
const HELICONE_LOGGING_ENDPOINT = HELICONE_API_ENDPOINT;


/**
 * Log a non-streaming LLM request to Helicone
 * 
 * @param {Object} providerRequest - The request sent to the LLM provider
 * @param {Object} providerResponse - The response received from the LLM provider
 * @param {number} startTime - Request start time in milliseconds
 * @param {number} endTime - Request end time in milliseconds
 * @param {Object} metadata - Additional metadata for the request (optional)
 * @returns {Promise} - The response from Helicone
 */
async function logNonStreamingRequest(providerRequest, providerResponse, startTime, endTime, metadata = {}) {
  if (!HELICONE_ENABLED || !HELICONE_API_KEY || !HELICONE_LOGGING_ENDPOINT) {
    log('Helicone logging skipped (disabled or missing config)');
    return null;
  }
  try {
    log('Logging non-streaming request to Helicone');
    const startTimeObj = {
      seconds: Math.floor(startTime / 1000),
      milliseconds: startTime % 1000
    };
    const endTimeObj = {
      seconds: Math.floor(endTime / 1000),
      milliseconds: endTime % 1000
    };
    const payload = {
      providerRequest: {
        url: providerRequest.url || "custom-model",
        json: providerRequest,
        meta: {
          environment: process.env.NODE_ENV || 'development',
          ...metadata
        }
      },
      providerResponse: {
        json: providerResponse,
        status: providerResponse.status || 200,
        headers: {
          'content-type': 'application/json'
        }
      },
      timing: {
        startTime: startTimeObj,
        endTime: endTimeObj
      }
    };
    log('Making Helicone logging request');
    
    // Prepare headers for the Helicone request
    const headers = {
      'Authorization': `Bearer ${HELICONE_API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Add Helicone-User-Id header if userId is provided in metadata
    if (metadata?.userId) {
      headers['Helicone-User-Id'] = metadata.userId;
      log(`Adding user ID to Helicone request: ${metadata.userId}`);
    }
    
    const response = await fetch(HELICONE_LOGGING_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Helicone logging failed:', response.status, response.statusText);
    } else {
      log('Successfully logged to Helicone');
    }
    return response;
  } catch (error) {
    console.error('Error logging to Helicone:', error.message);
    return null;
  }
}

/**
 * Log a streaming LLM request to Helicone
 * 
 * @param {Object} providerRequest - The request sent to the LLM provider
 * @param {Object} streamingResponses - Array of streaming responses or combined final response
 * @param {number} startTime - Request start time in milliseconds
 * @param {number} endTime - Request end time in milliseconds
 * @param {Object} metadata - Additional metadata for the request (optional)
 * @returns {Promise} - The response from Helicone
 */
async function logStreamingRequest(providerRequest, streamingResponses, startTime, endTime, metadata = {}) {
  try {
    log('Logging streaming request to Helicone');
    const streamingMetadata = {
      ...metadata,
      streaming: true,
      streamChunks: Array.isArray(streamingResponses) ? streamingResponses.length : 1
    };
    const combinedResponse = Array.isArray(streamingResponses) 
      ? {
          id: streamingResponses[0]?.id || 'streaming-response',
          choices: [{
            message: {
              content: streamingResponses
                .map(chunk => chunk?.choices?.[0]?.delta?.content || '')
                .join('')
            }
          }],
          model: providerRequest.model,
          object: 'chat.completion'
        }
      : streamingResponses;
    return logNonStreamingRequest(
      providerRequest, 
      combinedResponse, 
      startTime, 
      endTime, 
      streamingMetadata
    );
  } catch (error) {
    console.error('Error logging streaming request to Helicone:', error);
    return null;
  }
}

export {
  logNonStreamingRequest,
  logStreamingRequest
};
