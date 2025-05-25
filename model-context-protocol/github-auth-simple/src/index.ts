import type { Env } from './types';
import { cleanupOldStates, validateApiToken } from './db';
import { handleAuthorize, handleCallback, handleGetUser, handleGetDomains, handleUpdateDomains, handleCheckDomain, handleGetApiToken, handleGenerateApiToken, createErrorResponse } from './handlers';
import { handleAdminDatabaseDump } from './admin';

// Define the ScheduledEvent type for the scheduled function
interface ScheduledEvent {
  scheduledTime: number;
  cron: string;
}

// Define the TEST_CLIENT_HTML directly to avoid module issues
const TEST_CLIENT_HTML = require('./test-client').TEST_CLIENT_HTML;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    
    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
          return new Response(TEST_CLIENT_HTML, { 
            headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
          });
          
        case '/authorize':
          return handleAuthorize(request, env, corsHeaders);
          
        case '/callback':
          return handleCallback(request, env, corsHeaders);
          
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
          break;
          
        case '/admin/database-dump':
          if (request.method === 'GET') {
            return handleAdminDatabaseDump(request, env, corsHeaders);
          }
          break;
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
