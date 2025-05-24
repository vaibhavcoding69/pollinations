import type { Env, User } from './types';
import { createJWT, verifyJWT, extractBearerToken } from './jwt';
import { 
  ensureTables,
  upsertUser, 
  getUser, 
  updateDomainAllowlist, 
  getDomains, 
  isDomainAllowed, 
  saveOAuthState, 
  getOAuthState, 
  deleteOAuthState, 
  cleanupOldStates, 
  generateApiToken, 
  getApiToken, 
  deleteApiTokens, 
  validateApiToken, 
  savePkceSession, 
  getPkceSession, 
  deletePkceSession 
} from './db';
import { exchangeCodeForToken, getGitHubUser } from './github';
import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  getGitHubAuthorizeUrl, 
  createTokenResponse, 
  createOAuthErrorResponse, 
  generateOAuthMetadata 
} from './oauth-utils';
import { clientIdAlreadyApproved, parseRedirectApproval, renderApprovalDialog } from './oauth-approval';
import { handleTestPkceClient } from './test-pkce-client';

// Import the test client HTML
const { TEST_CLIENT_HTML } = require('./test-client');

// Function to handle the test client route
async function handleTestClient(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  return new Response(TEST_CLIENT_HTML, {
    headers: {
      'Content-Type': 'text/html',
      ...corsHeaders
    }
  });
}

// Define the ScheduledEvent type for the scheduled function
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Ensure all required tables exist in the database
    await ensureTables(env.DB);
    
    const url = new URL(request.url);
    const path = url.pathname;

    // Add CORS headers to all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle OPTIONS requests for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Handle OAuth approval form submissions
    if (path === '/approve' && request.method === 'POST') {
      try {
        const { state, headers } = await parseRedirectApproval(request, env.COOKIE_SECRET);
        
        // Redirect to the authorization endpoint with the original parameters
        const redirectUrl = new URL('/authorize', url.origin);
        if (state.redirectUri) redirectUrl.searchParams.set('redirect_uri', state.redirectUri);
        if (state.state) redirectUrl.searchParams.set('state', state.state);
        if (state.clientId) redirectUrl.searchParams.set('client_id', state.clientId);
        
        return Response.redirect(redirectUrl.toString(), 302);
      } catch (error) {
        console.error('Error processing approval:', error);
        return createOAuthErrorResponse('server_error', 'Failed to process approval', 500);
      }
    }

    try {
      // Route handling
      switch (url.pathname) {
        case '/':
          // Serve the test client at the root path
          return new Response(TEST_CLIENT_HTML, { 
            headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
          });
          
        case '/test-client':
          return handleTestClient(request, env, corsHeaders);
          
        case '/authorize':
          return handleAuthorize(request, env, corsHeaders);
          
        case '/callback':
          return handleCallback(request, env, corsHeaders);
          
        case '/test-pkce-client':
          return handleTestPkceClient(request);
          
        case '/token':
          return handleToken(request, env, corsHeaders);
          
        case '/.well-known/oauth-authorization-server':
          return generateOAuthMetadata(env, request);
          
        case '/api/user':
          return handleGetUser(request, env, corsHeaders);
          
        case '/api/domains':
          if (request.method === 'GET') {
            return handleGetDomains(request, env, corsHeaders);
          } else if (request.method === 'POST') {
            return handleUpdateDomains(request, env, corsHeaders);
          }
          break;
          
        case '/api/check-domain':
          return handleCheckDomain(request, env, corsHeaders);
          
        case '/api/token':
          if (request.method === 'GET') {
            return handleGetApiToken(request, env, corsHeaders);
          } else if (request.method === 'POST') {
            return handleGenerateApiToken(request, env, corsHeaders);
          }
      }
      
      return createErrorResponse(404, 'Resource not found', corsHeaders);
    } catch (error) {
      console.error('Error:', error);
      return createErrorResponse(500, 'Internal server error', corsHeaders);
    }
  },
  
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Clean up old OAuth states periodically
    await cleanupOldStates(env.DB);
  },
};

async function handleAuthorize(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Extract query parameters
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state') || crypto.randomUUID();
  
  // Use the configured callback URL that matches GitHub's registered URL
  const callbackUrl = new URL('/callback', url.origin);
  
  // Check for client_id in the request (optional for backward compatibility)
  const requestClientId = url.searchParams.get('client_id');
  
  // Validate required OAuth 2.1 parameters
  if (!redirectUri) {
    return createOAuthErrorResponse('invalid_request', 'Missing required parameter: redirect_uri', 400);
  }
  
  try {
    // If a client_id was provided and it's different from our own, check if it's been approved
    if (requestClientId && requestClientId !== clientId) {
      // Check if this client has been approved before
      const approved = await clientIdAlreadyApproved(request, requestClientId, env.COOKIE_SECRET);
      
      if (!approved) {
        // If not approved, show the approval dialog
        return renderApprovalDialog(request, {
          client: {
            clientId: requestClientId,
            clientName: `Application ${requestClientId.substring(0, 8)}...`,
          },
          server: {
            name: 'Pollinations GitHub Auth',
            logo: 'https://avatars.githubusercontent.com/u/79897291?s=200&v=4',
            description: 'This service allows applications to authenticate with GitHub on your behalf.',
          },
          state: {
            clientId: requestClientId,
            redirectUri,
            state,
          },
        });
      }
    }
    
    // Generate PKCE parameters
    const codeVerifier = generateCodeVerifier();
    const finalCodeChallenge = await generateCodeChallenge(codeVerifier);
    
    // Save PKCE session
    await savePkceSession(env.DB, { state, code_verifier: codeVerifier, redirect_uri: redirectUri });
    
    // Generate the GitHub authorization URL
    const authorizeUrl = getGitHubAuthorizeUrl({
      clientId,
      redirectUri: callbackUrl.toString(),
      state,
      codeChallenge: finalCodeChallenge,
    });
    
    // Redirect to GitHub for authorization
    return Response.redirect(authorizeUrl, 302);
  } catch (error) {
    console.error('Error in authorize:', error);
    return createOAuthErrorResponse('server_error', 'Failed to process authorization request', 500);
  }
}

async function handleCallback(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Extract query parameters
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Handle OAuth errors
  if (error) {
    return createOAuthErrorResponse(error, errorDescription || 'OAuth error', 400);
  }

  // Validate required parameters
  if (!code || !state) {
    return createOAuthErrorResponse('invalid_request', 'Missing required parameters: code, state', 400);
  }

  try {
    // Retrieve the PKCE session
    const pkceSession = await getPkceSession(env.DB, state);
    if (!pkceSession) {
      return createOAuthErrorResponse('invalid_request', 'Invalid or expired state parameter', 400);
    }

    // Get the code verifier from the PKCE session
    const codeVerifier = pkceSession.code_verifier;
    // Store the original redirect URI from the PKCE session for later use
    const originalRedirectUri = pkceSession.redirect_uri;
    
    // Use the registered callback URL for GitHub token exchange
    // This must match exactly what's registered in the GitHub OAuth app
    const registeredCallbackUrl = new URL('/callback', url.origin).toString();

    // Exchange the code for an access token using the code verifier for PKCE
    const accessToken = await exchangeCodeForToken(code, registeredCallbackUrl, env, codeVerifier);

    // Get the user's information from GitHub
    const githubUser = await getGitHubUser(accessToken);

    // Store or update the user in our database
    const user = await upsertUser(env.DB, {
      github_user_id: githubUser.id.toString(),
      username: githubUser.login,
    });

    // Create a JWT for the user
    const token = await createJWT(user.github_user_id, user.username, env);

    // Clean up the PKCE session
    await deletePkceSession(env.DB, state);

    // Redirect back to the client with the token
    // Use the original redirect URI from the PKCE session
    const clientRedirectUrl = new URL(originalRedirectUri);
    clientRedirectUrl.searchParams.set('token', token);
    clientRedirectUrl.searchParams.set('state', state);

    return Response.redirect(clientRedirectUrl.toString(), 302);
  } catch (error) {
    console.error('Error in callback:', error);
    return createOAuthErrorResponse('server_error', 'Failed to process callback', 500);
  }
}

async function handleToken(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Only accept POST requests
  if (request.method !== 'POST') {
    return createOAuthErrorResponse('invalid_request', 'Method not allowed', 405);
  }
  
  // Parse the request body
  let body: any;
  const contentType = request.headers.get('Content-Type') || '';
  
  try {
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries());
    } else if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      return createOAuthErrorResponse('invalid_request', 'Unsupported content type', 400);
    }
  } catch (error) {
    console.error('Error parsing request body:', error);
    return createOAuthErrorResponse('invalid_request', 'Invalid request body', 400);
  }
  
  // Validate grant type
  const grantType = body.grant_type;
  if (grantType !== 'authorization_code') {
    return createOAuthErrorResponse('unsupported_grant_type', 'Only authorization_code grant type is supported', 400);
  }
  
  // Validate required parameters
  const code = body.code;
  const redirectUri = body.redirect_uri;
  const codeVerifier = body.code_verifier;
  
  if (!code || !redirectUri) {
    return createOAuthErrorResponse('invalid_request', 'Missing required parameters', 400);
  }
  
  try {
    // Get the PKCE session using the state parameter
    // If state is not provided, we can't verify the code verifier
    let pkceSession = null;
    if (body.state) {
      pkceSession = await getPkceSession(env.DB, body.state);
      if (!pkceSession) {
        return createOAuthErrorResponse('invalid_request', 'Invalid or expired state parameter', 400);
      }
    }
    
    // Exchange the code for an access token
    const accessToken = await exchangeCodeForToken(code, redirectUri, env, pkceSession?.code_verifier);
    
    // Get the user's information from GitHub
    const githubUser = await getGitHubUser(accessToken);
    
    // Store or update the user in our database
    const user = await upsertUser(env.DB, {
      github_user_id: githubUser.id.toString(),
      username: githubUser.login,
    });
    
    // Create a JWT for the user
    const token = await createJWT(user.github_user_id, user.username, env);
    
    // Clean up the PKCE session if it exists
    if (pkceSession && body.state) {
      await deletePkceSession(env.DB, body.state);
    }
    
    // Return the token in the OAuth 2.1 format
    return createTokenResponse(token);
  } catch (error) {
    console.error('Error in token endpoint:', error);
    return createOAuthErrorResponse('server_error', 'Failed to process token request', 500);
  }
}

async function handleGetUser(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) {
    return createErrorResponse(401, 'Unauthorized', corsHeaders);
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload || !payload.sub) {
    return createErrorResponse(401, 'Invalid token', corsHeaders);
  }
  
  const user = await getUser(env.DB, payload.sub);
  if (!user) {
    return createErrorResponse(404, 'User not found', corsHeaders);
  }
  
  return new Response(JSON.stringify(user), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGetDomains(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  
  if (!userId) {
    return createErrorResponse(400, 'Missing required parameter: user_id', corsHeaders);
  }
  
  // Verify auth
  const token = extractBearerToken(request);
  if (!token) {
    return createErrorResponse(401, 'Unauthorized', corsHeaders);
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== userId) {
    return createErrorResponse(403, 'Forbidden', corsHeaders);
  }
  
  // Get the user's domains from the database
  const domains = await getDomains(env.DB, userId);
  return new Response(JSON.stringify({ domains }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleUpdateDomains(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  
  if (!userId) {
    return createErrorResponse(400, 'Missing required parameter: user_id', corsHeaders);
  }
  
  // Verify auth
  const token = extractBearerToken(request);
  if (!token) {
    return createErrorResponse(401, 'Unauthorized', corsHeaders);
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== userId) {
    return createErrorResponse(403, 'Forbidden', corsHeaders);
  }
  
  const { domains } = await request.json() as { domains: string[] };
  await updateDomainAllowlist(env.DB, userId, domains);
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleCheckDomain(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const domain = url.searchParams.get('domain');
  
  if (!userId || !domain) {
    return createErrorResponse(400, 'Missing required parameters', corsHeaders);
  }
  
  const allowed = await isDomainAllowed(env.DB, userId, domain);
  
  return new Response(JSON.stringify({ allowed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Creates a standardized error response
 * @param status HTTP status code
 * @param message User-friendly error message
 * @param headers Response headers
 * @returns Standardized error response
 */
function createErrorResponse(status: number, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({
    error: true,
    message
  }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

async function handleGetApiToken(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  
  if (!userId) {
    return createErrorResponse(400, 'Missing required parameter: user_id', corsHeaders);
  }
  
  // Verify auth
  const token = extractBearerToken(request);
  if (!token) {
    return createErrorResponse(401, 'Unauthorized', corsHeaders);
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== userId) {
    return createErrorResponse(403, 'Forbidden', corsHeaders);
  }
  
  // Get the user's API token
  const apiToken = await getApiToken(env.DB, userId);
  
  return new Response(JSON.stringify({ 
    token: apiToken,
    has_token: !!apiToken
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function handleGenerateApiToken(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  
  if (!userId) {
    return createErrorResponse(400, 'Missing required parameter: user_id', corsHeaders);
  }
  
  // Verify auth
  const token = extractBearerToken(request);
  if (!token) {
    return createErrorResponse(401, 'Unauthorized', corsHeaders);
  }
  
  const payload = await verifyJWT(token, env);
  if (!payload || payload.sub !== userId) {
    return createErrorResponse(403, 'Forbidden', corsHeaders);
  }
  
  // Generate a new API token
  const apiToken = await generateApiToken(env.DB, userId);
  
  return new Response(JSON.stringify({ 
    token: apiToken,
    generated: true
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
