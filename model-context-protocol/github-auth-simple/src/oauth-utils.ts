// Use Web Crypto API instead of Node.js crypto
import { Env } from './types';

/**
 * Generate a random string for PKCE code verifier
 */
export function generateCodeVerifier(): string {
  // Generate random bytes using Web Crypto API
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // Convert to base64url encoding
  return btoa(Array.from(array, byte => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate code challenge from code verifier using SHA-256
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // Encode the code verifier as UTF-8
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  
  // Hash using SHA-256
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to base64url encoding
  return btoa(Array.from(new Uint8Array(digest), byte => String.fromCharCode(byte)).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate the GitHub authorization URL with PKCE
 */
export function getGitHubAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'user:email');
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/**
 * Exchange GitHub authorization code for access token with PKCE
 */
export async function exchangeCodeForToken({
  code,
  codeVerifier,
  clientId,
  clientSecret,
  redirectUri,
}: {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ access_token: string } | null> {
  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });

    if (!response.ok) {
      console.error('Error exchanging code for token:', await response.text());
      return null;
    }

    const data = await response.json() as { access_token?: string; error?: string };
    if (data.error || !data.access_token) {
      console.error('Error from GitHub OAuth token endpoint:', data);
      return null;
    }

    return { access_token: data.access_token };
  } catch (error) {
    console.error('Exception exchanging code for token:', error);
    return null;
  }
}

/**
 * Generate a standard OAuth token response
 */
export function createTokenResponse(token: string, expiresIn: number = 86400): Response {
  return new Response(
    JSON.stringify({
      access_token: token,
      token_type: 'Bearer',
      expires_in: expiresIn,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Create a standard OAuth error response
 */
export function createOAuthErrorResponse(
  error: string,
  errorDescription: string,
  status: number = 400
): Response {
  return new Response(
    JSON.stringify({
      error,
      error_description: errorDescription,
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    }
  );
}

/**
 * Generate OAuth metadata for discovery
 */
export function generateOAuthMetadata(env: Env, request: Request): Response {
  const baseUrl = new URL(request.url).origin;
  
  return new Response(
    JSON.stringify({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/authorize`,
      token_endpoint: `${baseUrl}/token`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none'],
      code_challenge_methods_supported: ['S256'],
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
