import { generateCacheKey, cacheResponse } from './cache-utils.js';
import { proxyToOrigin } from './text-proxy.js';
import { generateVectorEmbedding, storeVector, querySimilarVectors } from './vector-utils.js';

/**
 * Cloudflare Worker for caching Pollinations text responses in R2
 * This worker acts as a thin proxy that:
 * 1. Checks if a text response is cached in R2
 * 2. Serves the cached response if available
 * 3. Proxies to the original service if not cached
 * 4. Caches the response for future requests
 */
export default {
  async fetch(request, env, ctx) {
    // Get basic request details
    const url = new URL(request.url);
    const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
    const method = request.method;
    
    console.log(`Request: ${method} ${url.pathname}`);
    
    // Check if this is a vector cache request
    const isVectorCacheRequest = url.pathname.startsWith('/vectorcache');
    console.log(`Path check: ${url.pathname}, isVectorCacheRequest: ${isVectorCacheRequest}`);
    
    if (isVectorCacheRequest) {
      // Handle the /vectorcache endpoint specifically
      if (url.pathname === '/vectorcache') {
        console.log('[VECTOR] Root vectorcache endpoint accessed');
        return new Response(JSON.stringify({
          status: 'ok',
          message: 'Vector cache endpoint is active',
          usage: 'Use /vectorcache/v1/chat/completions for vector-based caching'
        }), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, POST, OPTIONS',
            'access-control-allow-headers': 'Content-Type'
          }
        });
      }
      
      // Modify the URL to remove the /vectorcache prefix for further processing
      const originalPathname = url.pathname;
      url.pathname = url.pathname.replace('/vectorcache', '');
      console.log(`[VECTOR] Cache request detected. Original path: ${originalPathname}, Modified path: ${url.pathname}`);
      
      // Check if the modified path is empty and set it to '/' if needed
      if (url.pathname === '') {
        url.pathname = '/';
        console.log(`[VECTOR] Empty path detected, setting to root path: ${url.pathname}`);
      }
      
      // Special handling for chat completions
      if (originalPathname === '/vectorcache/v1/chat/completions') {
        console.log('[VECTOR] Chat completions endpoint accessed');
        
        try {
          // For POST requests, we need to read the body
          if (method === 'POST') {
            try {
              const requestBody = await request.clone().json();
              console.log('[VECTOR] Request body:', JSON.stringify(requestBody).substring(0, 200) + '...');
              
              // Create a new request to the origin with the modified URL
              const originUrl = new URL(`https://${env.ORIGIN_HOST}${url.pathname}`);
              console.log(`[VECTOR] Forwarding to origin: ${originUrl.toString()}`);
              
              // Create a new request with the same method, headers, and body
              const headers = new Headers(request.headers);
              headers.set('host', originUrl.hostname);
              
              const originRequest = new Request(originUrl.toString(), {
                method: request.method,
                headers: headers,
                body: request.body,
                redirect: 'follow',
              });
              
              // Forward the request to the origin
              console.log('[VECTOR] Sending direct request to origin...');
              const originResponse = await fetch(originRequest);
              console.log(`[VECTOR] Origin response status: ${originResponse.status}`);
              
              // Return the response from the origin
              return originResponse;
            } catch (error) {
              console.error('[VECTOR] Error processing chat completions request:', error);
              return new Response(JSON.stringify({
                error: 'Error processing request',
                details: error.message
              }), {
                status: 500,
                headers: {
                  'content-type': 'application/json',
                  'access-control-allow-origin': '*'
                }
              });
            }
          } else if (method === 'OPTIONS') {
            // Handle CORS preflight requests
            return new Response(null, {
              status: 204,
              headers: {
                'access-control-allow-origin': '*',
                'access-control-allow-methods': 'GET, POST, OPTIONS',
                'access-control-allow-headers': 'Content-Type',
                'access-control-max-age': '86400'
              }
            });
          }
        } catch (error) {
          console.error('[VECTOR] Unhandled error in chat completions endpoint:', error);
          return new Response(JSON.stringify({
            error: 'Internal server error',
            details: error.message
          }), {
            status: 500,
            headers: {
              'content-type': 'application/json',
              'access-control-allow-origin': '*'
            }
          });
        }
      }
    }
    
    // Skip caching for specific paths or when no-cache is specified
    const nonCacheablePaths = ['/models', '/feed'];
    if (url.searchParams.has('no-cache') || nonCacheablePaths.includes(url.pathname)) {
      console.log('Skipping cache for non-cacheable request');
      return await proxyToOrigin(request, env);
    }
    
    // Check if this is a streaming request
    const isStreamingRequest = url.searchParams.has('stream');
    
    // For POST requests, we need to read the body to generate the cache key
    let requestBody = null;
    let requestClone = request.clone();
    
    if (method === 'POST') {
      try {
        requestBody = await request.clone().json();
        console.log('Request body parsed for cache key generation');
      } catch (error) {
        console.error('Error parsing request body:', error);
        // If we can't parse the body, we can't generate a proper cache key
        // So we'll just proxy the request to the origin
        return await proxyToOrigin(requestClone, env);
      }
    }
    
    // Generate a cache key from the URL path, query parameters, and request body
    const cacheKey = generateCacheKey(url, requestBody);
    console.log('Cache key:', cacheKey);
    
    // Check if we have this response cached in R2
    try {
      const cachedResponse = await env.TEXT_BUCKET.get(cacheKey);
      
      if (cachedResponse) {
        console.log(`Cache hit for: ${cacheKey}`);
        // Return the cached response with appropriate headers
        const cachedHeaders = new Headers();
        
        // Use the stored HTTP metadata if available
        if (cachedResponse.httpMetadata) {
          if (cachedResponse.httpMetadata.contentType) {
            cachedHeaders.set('content-type', cachedResponse.httpMetadata.contentType);
          }
          if (cachedResponse.httpMetadata.contentEncoding) {
            cachedHeaders.set('content-encoding', cachedResponse.httpMetadata.contentEncoding);
          }
          if (cachedResponse.httpMetadata.contentDisposition) {
            cachedHeaders.set('content-disposition', cachedResponse.httpMetadata.contentDisposition);
          }
          if (cachedResponse.httpMetadata.contentLanguage) {
            cachedHeaders.set('content-language', cachedResponse.httpMetadata.contentLanguage);
          }
        } else {
          // Fallback to default content type
          if (isStreamingRequest) {
            cachedHeaders.set('content-type', 'text/event-stream; charset=utf-8');
          } else if (typeof cachedResponse.body === 'string') {
            cachedHeaders.set('content-type', 'text/plain; charset=utf-8');
          } else {
            // Try to detect JSON content
            try {
              // Peek at the first few bytes of the response to check if it starts with '{'
              const reader = cachedResponse.body.getReader();
              const { value } = await reader.read();
              const firstChar = new TextDecoder().decode(value.slice(0, 1));
              
              if (firstChar === '{' || firstChar === '[') {
                cachedHeaders.set('content-type', 'application/json; charset=utf-8');
              } else {
                cachedHeaders.set('content-type', 'text/plain; charset=utf-8');
              }
              
              // Reset the reader by getting a fresh copy of the cached response
              let freshCachedResponse = await env.TEXT_BUCKET.get(cacheKey);
              return new Response(freshCachedResponse.body, {
                headers: cachedHeaders
              });
            } catch (error) {
              console.error('Error detecting content type:', error);
              cachedHeaders.set('content-type', 'application/json; charset=utf-8');
            }
          }
        }

        // Always set these headers for cache control and CORS
        cachedHeaders.set('cache-control', 'public, max-age=31536000, immutable');
        cachedHeaders.set('x-cache', 'HIT');
        cachedHeaders.set('access-control-allow-origin', '*');
        cachedHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
        cachedHeaders.set('access-control-allow-headers', 'Content-Type');
        
        return new Response(cachedResponse.body, {
          headers: cachedHeaders
        });
      }
    } catch (error) {
      console.error('Error retrieving cached response:', error);
    }
    
    console.log(`Cache miss for: ${cacheKey}`);
    
    // For vector cache requests, try to find a similar cached response
    if (isVectorCacheRequest && env.VECTORIZE_CACHE) {
      try {
        console.log('[VECTOR] Checking for similar cached responses using vector search');
        
        // Generate a vector embedding for this request
        const vector = generateVectorEmbedding(url, requestBody);
        console.log('[VECTOR] Generated embedding with dimensions:', vector.length);
        
        // Query Vectorize for similar vectors
        const similarVectors = await querySimilarVectors(vector, env, 5, 0.8);
        
        if (similarVectors.length > 0) {
          console.log(`[VECTOR] Found ${similarVectors.length} similar cached responses`);
          console.log(`[VECTOR] Best match score: ${similarVectors[0].score}, URL: ${similarVectors[0].url}`);
          
          // Use the most similar vector (first in the array)
          const bestMatch = similarVectors[0];
          console.log(`[VECTOR] Using cached response with key: ${bestMatch.cacheKey} (similarity score: ${bestMatch.score})`);
          
          // Get the cached response from R2
          const similarCachedResponse = await env.TEXT_BUCKET.get(bestMatch.cacheKey);
          
          if (similarCachedResponse) {
            // Return the cached response with appropriate headers
            const cachedHeaders = new Headers();
            
            // Use the stored HTTP metadata if available
            if (similarCachedResponse.httpMetadata) {
              if (similarCachedResponse.httpMetadata.contentType) {
                cachedHeaders.set('content-type', similarCachedResponse.httpMetadata.contentType);
              }
              if (similarCachedResponse.httpMetadata.contentEncoding) {
                cachedHeaders.set('content-encoding', similarCachedResponse.httpMetadata.contentEncoding);
              }
              if (similarCachedResponse.httpMetadata.contentDisposition) {
                cachedHeaders.set('content-disposition', similarCachedResponse.httpMetadata.contentDisposition);
              }
              if (similarCachedResponse.httpMetadata.contentLanguage) {
                cachedHeaders.set('content-language', similarCachedResponse.httpMetadata.contentLanguage);
              }
            } else {
              // Fallback to default content type
              if (isStreamingRequest) {
                cachedHeaders.set('content-type', 'text/event-stream; charset=utf-8');
              } else {
                cachedHeaders.set('content-type', 'application/json; charset=utf-8');
              }
            }

            // Set headers for cache control and CORS
            cachedHeaders.set('cache-control', 'public, max-age=31536000, immutable');
            cachedHeaders.set('x-cache', 'VECTOR-HIT');
            cachedHeaders.set('x-vector-similarity', bestMatch.score.toString());
            cachedHeaders.set('x-vector-original-key', bestMatch.cacheKey);
            cachedHeaders.set('access-control-allow-origin', '*');
            cachedHeaders.set('access-control-allow-methods', 'GET, POST, OPTIONS');
            cachedHeaders.set('access-control-allow-headers', 'Content-Type');
            
            return new Response(similarCachedResponse.body, {
              headers: cachedHeaders
            });
          }
        } else {
          console.log('[VECTOR] No similar cached responses found');
        }
      } catch (error) {
        console.error('[VECTOR] Error in vector cache lookup:', error);
      }
    }
    
    // Cache miss - proxy to origin
    console.log('Proxying request to origin service...');
    const response = await proxyToOrigin(requestClone, env);
    
    // Only cache successful responses (including streaming responses)
    if (response.status === 200) {
      // Check content type to determine if it's a text, JSON, or streaming response
      const contentType = response.headers.get('content-type') || '';
      const isTextResponse = contentType.includes('text/') || 
                            contentType.includes('application/json') || 
                            contentType.includes('application/javascript') ||
                            contentType.includes('application/xml') ||
                            contentType.includes('application/ld+json');
      
      // Check if this is a streaming response
      const isStreamingResponse = contentType.includes('text/event-stream');
      
      // Cache both regular text responses and streaming responses
      if (isTextResponse || isStreamingResponse) {
        console.log('Caching successful text response');
        // Pass the original URL and request to the cacheResponse function
        ctx.waitUntil(cacheResponse(cacheKey, response.clone(), env, url.toString(), request));
        
        // For vector cache requests, also store the vector embedding
        if (isVectorCacheRequest && env.VECTORIZE_CACHE) {
          try {
            console.log('[VECTOR] Storing vector embedding for future similarity matching');
            const vector = generateVectorEmbedding(url, requestBody);
            console.log('[VECTOR] Generated embedding for storage with dimensions:', vector.length);
            const storeResult = await storeVector(cacheKey, vector, url, requestBody, env);
            console.log('[VECTOR] Storage result:', JSON.stringify(storeResult));
            ctx.waitUntil(Promise.resolve(storeResult));
          } catch (error) {
            console.error('[VECTOR] Error storing vector embedding:', error);
          }
        }
      } else {
        console.log('Not caching non-text response with content-type:', contentType);
      }
    } else {
      console.log('Not caching unsuccessful response with status:', response.status);
    }
    
    // Add cache miss header to the response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('x-cache', 'MISS');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};