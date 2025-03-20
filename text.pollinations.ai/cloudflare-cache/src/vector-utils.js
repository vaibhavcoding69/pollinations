/**
 * Utility functions for vector operations with Cloudflare Vectorize
 * This enables semantic caching for text responses
 */

/**
 * Generate a vector embedding from a request
 * This is a simple hash-based approach for demonstration purposes
 * In a production environment, you would use a proper embedding model
 * @param {URL} url - The URL object
 * @param {Object} requestBody - The request body (for POST requests)
 * @returns {Array<number>} - The vector embedding (32 dimensions)
 */
export function generateVectorEmbedding(url, requestBody = null) {
  // Start timing
  const startTime = performance.now();
  
  // Convert the URL and request body to a string
  const urlString = url.toString();
  const bodyString = requestBody ? JSON.stringify(requestBody) : '';
  const combinedString = urlString + bodyString;
  
  console.log(`[VECTOR] Generating embedding for URL: ${urlString.substring(0, 100)}...`);
  if (requestBody) {
    console.log(`[VECTOR] Request body included in embedding (${bodyString.length} chars)`);
  }
  
  // Create a 32-dimension vector from the string
  // This is a simple deterministic approach - in production you would use a real embedding model
  const vector = new Array(32).fill(0);
  
  for (let i = 0; i < combinedString.length; i++) {
    const charCode = combinedString.charCodeAt(i);
    // Distribute character values across the vector dimensions
    const dimension = i % 32;
    // Add a normalized value (between 0 and 1) to the vector
    vector[dimension] += (charCode / 255) * 0.01;
    
    // Ensure values stay within a reasonable range (0-1)
    if (vector[dimension] > 1) {
      vector[dimension] = vector[dimension] % 1;
    }
  }
  
  // Normalize the vector to have values between 0 and 1
  const max = Math.max(...vector);
  if (max > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] = vector[i] / max;
    }
  }
  
  // End timing and log
  const endTime = performance.now();
  const timeElapsed = endTime - startTime;
  
  console.log(`[VECTOR] Generated ${vector.length}-dimension vector`);
  console.log(`[VECTOR] Vector generation took ${timeElapsed.toFixed(2)}ms`);
  return vector;
}

/**
 * Store a vector in Vectorize with metadata
 * @param {string} cacheKey - The cache key (used as vector ID)
 * @param {Array<number>} vector - The vector embedding
 * @param {string} url - The original URL
 * @param {Object} requestBody - The original request body
 * @param {Object} env - The environment object with Vectorize binding
 * @returns {Promise<Object>} - The result of the insert operation
 */
export async function storeVector(cacheKey, vector, url, requestBody, env) {
  try {
    console.log(`[VECTOR] Storing vector with ID: ${cacheKey}`);
    
    // Create metadata for the vector
    const metadata = {
      url: url.toString(),
      cacheKey: cacheKey,
      method: requestBody ? 'POST' : 'GET',
      timestamp: new Date().toISOString()
    };
    
    // If there's a request body, add relevant parts to metadata
    if (requestBody) {
      // Extract only the parts of the request body that affect the response
      const relevantBodyParts = {
        model: requestBody.model,
        messages: requestBody.messages ? 
          requestBody.messages.map(m => ({ role: m.role, content: m.content?.substring(0, 100) })) : 
          undefined
      };
      
      metadata.requestBody = JSON.stringify(relevantBodyParts).substring(0, 1000);
      console.log(`[VECTOR] Added request body metadata (model: ${requestBody.model})`);
    }
    
    // Create the vector object
    const vectorObject = {
      id: cacheKey,
      values: vector,
      metadata: metadata
    };
    
    // Insert the vector into Vectorize
    const result = await env.VECTORIZE_CACHE.upsert([vectorObject]);
    console.log(`[VECTOR] Vector stored successfully with ID: ${cacheKey}`);
    return result;
  } catch (error) {
    console.error(`[VECTOR] Error storing vector: ${error.message}`);
    return null;
  }
}

/**
 * Query Vectorize for similar vectors
 * @param {Array<number>} vector - The query vector
 * @param {Object} env - The environment object with Vectorize binding
 * @param {number} topK - Number of results to return (default: 5)
 * @param {number} similarityThreshold - Minimum similarity score to consider a match (default: 0.8)
 * @returns {Promise<Array>} - Array of matching vectors with their cache keys
 */
export async function querySimilarVectors(vector, env, topK = 5, similarityThreshold = 0.8) {
  try {
    const startTime = performance.now();
    console.log(`[VECTOR] Querying for similar vectors (topK: ${topK}, threshold: ${similarityThreshold})`);
    
    // Query Vectorize for similar vectors
    const matches = await env.VECTORIZE_CACHE.query(vector, {
      topK: topK,
      returnValues: false,  // We don't need the vector values
      returnMetadata: 'all'  // We need all metadata to get the cache key
    });
    
    const endTime = performance.now();
    const queryTime = endTime - startTime;
    console.log(`[VECTOR] Query took ${queryTime.toFixed(2)}ms`);
    console.log(`[VECTOR] Found ${matches.count} potential vector matches`);
    
    // Filter matches by similarity threshold
    // For euclidean distance, lower scores are better (closer)
    // For cosine similarity, higher scores are better (more similar)
    // We'll assume euclidean distance is being used, so we want scores below the threshold
    const filteredMatches = matches.matches.filter(match => match.score < (1 - similarityThreshold));
    
    console.log(`[VECTOR] ${filteredMatches.length} matches passed similarity threshold (${similarityThreshold})`);
    
    // Log details about each match
    if (filteredMatches.length > 0) {
      // Log the closest match (lowest score for euclidean distance)
      const closestMatch = filteredMatches[0];
      console.log(`[VECTOR] Closest match: ID=${closestMatch.id}, score=${closestMatch.score}, similarity=${(1-closestMatch.score).toFixed(4)}, key=${closestMatch.metadata.cacheKey}`);
      
      // Log details about each match
      filteredMatches.forEach((match, index) => {
        console.log(`[VECTOR] Match ${index + 1}: score=${match.score}, similarity=${(1-match.score).toFixed(4)}, key=${match.metadata.cacheKey}, timestamp=${match.metadata.timestamp}`);
      });
    } else {
      console.log(`[VECTOR] No matches found that meet the similarity threshold`);
    }
    
    // Return the cache keys of the matching vectors
    return filteredMatches.map(match => ({
      cacheKey: match.metadata.cacheKey,
      score: match.score,
      similarity: (1 - match.score).toFixed(4),
      url: match.metadata.url,
      timestamp: match.metadata.timestamp
    }));
  } catch (error) {
    console.error(`[VECTOR] Error querying vectors: ${error.message}`);
    return [];
  }
}
