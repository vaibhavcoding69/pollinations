import type { Env } from './types';
import { getAllUsers, getAllDomains, getAllApiTokens, getAllOAuthStates } from './db';

// Admin authentication middleware
export function verifyAdminAuth(request: Request, env: Env): boolean {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    if (token === env.ADMIN_API_KEY) {
      return true;
    }
  }
  
  // Check query parameter as fallback
  const url = new URL(request.url);
  const queryToken = url.searchParams.get('admin_key');
  if (queryToken && queryToken === env.ADMIN_API_KEY) {
    return true;
  }
  
  return false;
}

// Creates a standardized error response
function createErrorResponse(status: number, message: string, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({
    error: true,
    message
  }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
}

export async function handleAdminDatabaseDump(request: Request, env: Env, corsHeaders: Record<string, string>): Promise<Response> {
  // Verify admin authentication
  if (!verifyAdminAuth(request, env)) {
    return createErrorResponse(401, 'Unauthorized: Invalid admin API key', corsHeaders);
  }
  
  try {
    // Get all data from important tables
    const [users, domains, apiTokens, oauthStates] = await Promise.all([
      getAllUsers(env.DB),
      getAllDomains(env.DB),
      getAllApiTokens(env.DB),
      getAllOAuthStates(env.DB)
    ]);
    
    const databaseDump = {
      timestamp: new Date().toISOString(),
      summary: {
        total_users: users.length,
        total_domains: domains.length,
        total_api_tokens: apiTokens.length,
        total_oauth_states: oauthStates.length
      },
      data: {
        users,
        domains,
        api_tokens: apiTokens,
        oauth_states: oauthStates
      }
    };
    
    return new Response(JSON.stringify(databaseDump, null, 2), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
    });
  } catch (error) {
    console.error('Error generating database dump:', error);
    return createErrorResponse(500, 'Error generating database dump', corsHeaders);
  }
}
