/**
 * Test script for the vector cache functionality
 * This script tests both regular caching and vector-based semantic caching
 */

// Import required modules
import fetch from 'node-fetch';

// Configuration
const BASE_URL = 'http://localhost:8787'; // Local development URL
// const BASE_URL = 'https://text.pollinations.ai'; // Production URL

// Test data
const testPrompt = {
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Tell me about vector databases in 50 words.' }
  ]
};

// Similar test data (should hit vector cache)
const similarPrompt = {
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain vector databases briefly in 50 words.' }
  ]
};

// Different test data (should not hit vector cache)
const differentPrompt = {
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the capital of France?' }
  ]
};

/**
 * Make a request to the API
 * @param {string} endpoint - The endpoint to call
 * @param {Object} data - The request body
 * @returns {Promise<Object>} - The response
 */
async function makeRequest(endpoint, data) {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  // Read the response body
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch (e) {
    body = text;
  }
  
  // Return the response with headers
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body
  };
}

/**
 * Run the test
 */
async function runTest() {
  console.log('Starting vector cache test...');
  
  try {
    // Test 1: Make a request to the regular endpoint (should be a cache miss)
    console.log('\n=== Test 1: Regular endpoint (first request) ===');
    const regularResponse1 = await makeRequest('/completion', testPrompt);
    console.log('Status:', regularResponse1.status);
    console.log('Cache status:', regularResponse1.headers['x-cache']);
    console.log('Response preview:', JSON.stringify(regularResponse1.body).substring(0, 100) + '...');
    
    // Test 2: Make the same request again (should be a cache hit)
    console.log('\n=== Test 2: Regular endpoint (second request - should be cache hit) ===');
    const regularResponse2 = await makeRequest('/completion', testPrompt);
    console.log('Status:', regularResponse2.status);
    console.log('Cache status:', regularResponse2.headers['x-cache']);
    console.log('Response preview:', JSON.stringify(regularResponse2.body).substring(0, 100) + '...');
    
    // Test 3: Make a request to the vector cache endpoint with a similar prompt
    console.log('\n=== Test 3: Vector cache endpoint with similar prompt ===');
    const vectorResponse = await makeRequest('/vectorcache/completion', similarPrompt);
    console.log('Status:', vectorResponse.status);
    console.log('Cache status:', vectorResponse.headers['x-cache']);
    console.log('Vector similarity:', vectorResponse.headers['x-vector-similarity']);
    console.log('Original cache key:', vectorResponse.headers['x-vector-original-key']);
    console.log('Response preview:', JSON.stringify(vectorResponse.body).substring(0, 100) + '...');
    
    // Test 4: Make a request to the vector cache endpoint with a different prompt
    console.log('\n=== Test 4: Vector cache endpoint with different prompt ===');
    const differentResponse = await makeRequest('/vectorcache/completion', differentPrompt);
    console.log('Status:', differentResponse.status);
    console.log('Cache status:', differentResponse.headers['x-cache']);
    console.log('Response preview:', JSON.stringify(differentResponse.body).substring(0, 100) + '...');
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error running test:', error);
  }
}

// Run the test
runTest();
