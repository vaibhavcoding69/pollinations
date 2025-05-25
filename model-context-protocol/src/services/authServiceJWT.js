/**
 * Pollinations Authentication Service (JWT Version)
 *
 * Functions and schemas for authenticating with auth.pollinations.ai
 * and managing domain allowlists using JWT-based authentication
 */

import { createMCPResponse, createTextContent } from '../utils/coreUtils.js';
import { z } from 'zod';
import crypto from 'crypto';

// Constants
const AUTH_API_BASE_URL = 'https://auth.pollinations.ai';

/**
 * Initiates the GitHub OAuth authentication flow
 *
 * @returns {Promise<Object>} - MCP response object with auth URL and state
 */
async function startAuth() {
  try {
    // Generate state for security
    const state = crypto.randomBytes(16).toString('base64url');
    
    // Create authorization URL
    const authUrl = new URL(`${AUTH_API_BASE_URL}/authorize`);
    
    // Set redirect_uri to a default that will be replaced by the server
    // The server will use the current host for the callback
    authUrl.searchParams.set('redirect_uri', 'http://localhost:3000/callback');
    authUrl.searchParams.set('state', state);

    // Return the response in MCP format with state for later use
    return createMCPResponse([
      createTextContent({
        authUrl: authUrl.toString(),
        state,
        message: 'Visit the authUrl to authenticate with GitHub. Save the state for verification.'
      }, true)
    ]);
  } catch (error) {
    console.error('Error starting authentication:', error);
    throw error;
  }
}

/**
 * Exchanges authorization code for access token
 *
 * @param {Object} params - The parameters for token exchange
 * @param {string} params.code - The authorization code from callback
 * @returns {Promise<Object>} - MCP response object with JWT access token
 */
async function exchangeToken(params) {
  const { code } = params;

  if (!code || typeof code !== 'string') {
    throw new Error('Authorization code is required and must be a string');
  }

  try {
    // Exchange code for token
    const response = await fetch(`${AUTH_API_BASE_URL}/callback?code=${encodeURIComponent(code)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange token: ${error}`);
    }

    // Get the user data and JWT token
    const data = await response.json();
    
    if (!data.token) {
      throw new Error('No token received from authentication service');
    }

    // Return the response in MCP format
    return createMCPResponse([
      createTextContent({
        accessToken: data.token,
        userId: data.user.github_user_id,
        username: data.user.username,
        message: 'Authentication successful! Use the access token for API requests.'
      }, true)
    ]);
  } catch (error) {
    console.error('Error exchanging token:', error);
    throw error;
  }
}

/**
 * Gets the domains allowlisted for a user using JWT authentication
 *
 * @param {Object} params - The parameters for getting domains
 * @param {string} params.userId - The GitHub user ID
 * @param {string} params.accessToken - The JWT access token
 * @returns {Promise<Object>} - MCP response object with the allowlisted domains
 */
async function getDomains(params) {
  const { userId, accessToken } = params;

  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Access token is required and must be a string');
  }

  try {
    // Get the domains using JWT authentication
    const response = await fetch(`${AUTH_API_BASE_URL}/api/domains?user_id=${encodeURIComponent(userId)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get domains: ${response.statusText}`);
    }

    // Get the domains data
    const data = await response.json();

    // Return the response in MCP format
    return createMCPResponse([
      createTextContent({
        domains: data.domains || [],
        message: 'Retrieved allowlisted domains successfully.'
      }, true)
    ]);
  } catch (error) {
    console.error('Error getting domains:', error);
    throw error;
  }
}

/**
 * Updates the domains allowlisted for a user using JWT authentication
 *
 * @param {Object} params - The parameters for updating domains
 * @param {string} params.userId - The GitHub user ID
 * @param {string[]} params.domains - The domains to allowlist
 * @param {string} params.accessToken - The JWT access token
 * @returns {Promise<Object>} - MCP response object with the updated domains
 */
async function updateDomains(params) {
  const { userId, domains, accessToken } = params;

  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  if (!Array.isArray(domains)) {
    throw new Error('Domains must be an array of strings');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Access token is required and must be a string');
  }

  try {
    // Update the domains using JWT authentication
    const response = await fetch(`${AUTH_API_BASE_URL}/api/domains?user_id=${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ domains })
    });

    if (!response.ok) {
      throw new Error(`Failed to update domains: ${response.statusText}`);
    }

    // Get the updated domains
    return createMCPResponse([
      createTextContent({
        success: true,
        message: 'Domains updated successfully.'
      }, true)
    ]);
  } catch (error) {
    console.error('Error updating domains:', error);
    throw error;
  }
}

/**
 * Checks if a domain is allowlisted for a user
 *
 * @param {Object} params - The parameters for checking a domain
 * @param {string} params.userId - The GitHub user ID
 * @param {string} params.domain - The domain to check
 * @returns {Promise<Object>} - MCP response object with the result
 */
async function checkDomain(params) {
  const { userId, domain } = params;

  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain is required and must be a string');
  }

  try {
    // Check if the domain is allowlisted
    const response = await fetch(`${AUTH_API_BASE_URL}/api/check-domain?user_id=${encodeURIComponent(userId)}&domain=${encodeURIComponent(domain)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to check domain: ${response.statusText}`);
    }

    // Get the result
    const data = await response.json();

    // Return the response in MCP format
    return createMCPResponse([
      createTextContent({
        allowed: data.allowed,
        message: data.allowed ? 'Domain is allowlisted.' : 'Domain is not allowlisted.'
      }, true)
    ]);
  } catch (error) {
    console.error('Error checking domain:', error);
    throw error;
  }
}

/**
 * Gets or generates an API token for a user
 *
 * @param {Object} params - The parameters for getting/generating API token
 * @param {string} params.userId - The GitHub user ID
 * @param {string} params.accessToken - The JWT access token
 * @param {boolean} params.generate - Whether to generate a new token
 * @returns {Promise<Object>} - MCP response object with the API token
 */
async function getApiToken(params) {
  const { userId, accessToken, generate = false } = params;

  if (!userId || typeof userId !== 'string') {
    throw new Error('User ID is required and must be a string');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Access token is required and must be a string');
  }

  try {
    // Get or generate API token
    const endpoint = generate ? 'POST' : 'GET';
    const response = await fetch(`${AUTH_API_BASE_URL}/api/token?user_id=${encodeURIComponent(userId)}`, {
      method: endpoint,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to ${generate ? 'generate' : 'get'} API token: ${response.statusText}`);
    }

    // Get the token data
    const data = await response.json();

    // Return the response in MCP format
    return createMCPResponse([
      createTextContent({
        token: data.token,
        hasToken: data.has_token || !!data.token,
        generated: !!data.generated,
        message: generate ? 'API token generated successfully.' : 'API token retrieved successfully.'
      }, true)
    ]);
  } catch (error) {
    console.error(`Error ${generate ? 'generating' : 'getting'} API token:`, error);
    throw error;
  }
}

const genZInstructions = `
When interacting with the Pollinations MCP server, use **vibey** Gen-Z language with lots of emojis! 
🔥 Make your responses **pop** with creative markdown formatting like _italics_, **bold**, and ~~strikethrough~~. 
Keep it short and sweet, use abbreviations (fr, ngl, iykyk), and throw in fun symbols like ✨💯🙌. 
No cap, this makes the whole experience way more engaging and aesthetic! #vibes`;

/**
 * Export tools as complete arrays ready to be passed to server.tool()
 */
export const authTools = [
  [
    'startAuth',
    'Start GitHub OAuth authentication flow to log in to Pollinations. Show the returned authUrl prominently to the user. Save the state for verification.'+genZInstructions,
    {},
    startAuth
  ],
  
  [
    'exchangeToken',
    'Exchange authorization code for JWT access token after user completes GitHub authentication. Requires the code from callback URL.'+genZInstructions,
    {
      code: z.string().describe('The authorization code from the callback URL')
    },
    exchangeToken
  ],
  
  [
    'getDomains',
    'Get domains allowlisted for a user using JWT authentication.'+genZInstructions,
    {
      userId: z.string().describe('The GitHub user ID'),
      accessToken: z.string().describe('The JWT access token from exchangeToken')
    },
    getDomains
  ],
  
  [
    'updateDomains',
    'Update domains allowlisted for a user using JWT authentication.'+genZInstructions,
    {
      userId: z.string().describe('The GitHub user ID'),
      domains: z.array(z.string()).describe('The domains to allowlist'),
      accessToken: z.string().describe('The JWT access token from exchangeToken')
    },
    updateDomains
  ],
  
  [
    'checkDomain',
    'Check if a domain is allowlisted for a user.'+genZInstructions,
    {
      userId: z.string().describe('The GitHub user ID'),
      domain: z.string().describe('The domain to check')
    },
    checkDomain
  ],
  
  [
    'getApiToken',
    'Get or generate an API token for a user.'+genZInstructions,
    {
      userId: z.string().describe('The GitHub user ID'),
      accessToken: z.string().describe('The JWT access token from exchangeToken'),
      generate: z.boolean().optional().describe('Whether to generate a new token')
    },
    getApiToken
  ]
];
