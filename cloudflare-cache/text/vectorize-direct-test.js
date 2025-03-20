// Direct test of Cloudflare Vectorize API without using Workers
// Requires: npm install node-fetch
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to .env file
const envPath = resolve(__dirname, '.env');
console.log('Current directory:', __dirname);
console.log('.env file path:', envPath);
console.log('.env file exists:', fs.existsSync(envPath));

// Try to load from .env file if available
try {
  const result = dotenv.config({ path: envPath });
  console.log('dotenv load result:', result);
} catch (error) {
  console.log('dotenv error:', error);
  console.log('using environment variables directly');
}

// Configuration - Replace these with your actual values
const CLOUDFLARE_API_TOKEN = process.env.CLOUDFLARE_AUTH_TOKEN; // Your Cloudflare API token
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID; // Your Cloudflare account ID
const CLOUDFLARE_EMAIL = process.env.CLOUDFLARE_EMAIL || 'your-email@example.com'; // Your Cloudflare email
const VECTORIZE_INDEX_NAME = 'test-index'; // The name of your Vectorize index

// Log token info (masked for security)
console.log('API Token available:', !!CLOUDFLARE_API_TOKEN);
if (CLOUDFLARE_API_TOKEN) {
  const maskedToken = CLOUDFLARE_API_TOKEN.substring(0, 4) + '...' + 
                     CLOUDFLARE_API_TOKEN.substring(CLOUDFLARE_API_TOKEN.length - 4);
  console.log('API Token (masked):', maskedToken);
  
  // Check if this might be an API key (32 hex characters) instead of an API token
  const isLikelyApiKey = /^[a-f0-9]{32}$/i.test(CLOUDFLARE_API_TOKEN);
  console.log('Token format looks like an API key:', isLikelyApiKey);
}
console.log('Account ID available:', !!CLOUDFLARE_ACCOUNT_ID);
if (CLOUDFLARE_ACCOUNT_ID) {
  console.log('Account ID:', CLOUDFLARE_ACCOUNT_ID);
  
  // Check if this might be a zone ID instead of an account ID
  const isLikelyZoneId = /^[a-f0-9]{32}$/i.test(CLOUDFLARE_ACCOUNT_ID);
  console.log('Account ID format looks like a zone/account ID:', isLikelyZoneId);
}

// Base URL for Cloudflare API
const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/vectorize`;

// Helper function for API requests
async function callCloudflareAPI(endpoint, method = 'GET', body = null) {
  const url = `${API_BASE}/${endpoint}`;
  
  console.log('Making API request to:', url);
  
  // Try API Token authentication first
  let options = {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };
  
  console.log('Using API Token authentication');
  console.log('Request headers:', JSON.stringify({
    ...options.headers,
    'Authorization': 'Bearer ***REDACTED***'
  }, null, 2));
  
  if (body) {
    options.body = JSON.stringify(body);
    console.log('Request body:', JSON.stringify(body, null, 2));
  }
  
  try {
    let response = await fetch(url, options);
    let data = await response.json();
    
    console.log('Response status:', response.status);
    
    // If API Token authentication fails, try API Key authentication
    if (response.status === 403 || response.status === 401) {
      console.log('API Token authentication failed, trying API Key authentication');
      
      // For API keys, use X-Auth-Email and X-Auth-Key
      options = {
        method,
        headers: {
          'X-Auth-Key': CLOUDFLARE_API_TOKEN,
          'X-Auth-Email': CLOUDFLARE_EMAIL,
          'Content-Type': 'application/json'
        }
      };
      
      console.log('Request headers:', JSON.stringify({
        ...options.headers,
        'X-Auth-Key': '***REDACTED***'
      }, null, 2));
      
      if (body) {
        options.body = JSON.stringify(body);
      }
      
      response = await fetch(url, options);
      data = await response.json();
      
      console.log('Response status:', response.status);
      console.log('Response data:', JSON.stringify(data, null, 2));
    } else {
      console.log('Response data:', JSON.stringify(data, null, 2));
    }
    
    if (!data.success) {
      throw new Error(`API Error: ${JSON.stringify(data.errors)}`);
    }
    
    return data.result;
  } catch (error) {
    console.error('API Request Failed:', error);
    throw error;
  }
}

// Simple function to convert strings to vectors (for testing only)
function stringToVector(str, dimensions = 32) {
  const vector = new Array(dimensions).fill(0);
  for (let i = 0; i < str.length && i < dimensions; i++) {
    vector[i] = str.charCodeAt(i) / 255;
  }
  return vector;
}

// Sample data for testing
const testData = [
  { id: "1", text: "hello world", category: "greeting" },
  { id: "2", text: "hello there", category: "greeting" },
  { id: "3", text: "hi world", category: "greeting" },
  { id: "4", text: "goodbye world", category: "farewell" },
  { id: "5", text: "completely different text", category: "other" }
];

// API Functions

// List all indexes
async function listIndexes() {
  return callCloudflareAPI('indexes');
}

// Create a new index
async function createIndex(name, dimensions = 32, metric = 'cosine') {
  return callCloudflareAPI('indexes', 'POST', {
    name,
    dimensions,
    metric
  });
}

// Get index details
async function getIndex(indexName) {
  return callCloudflareAPI(`indexes/${indexName}`);
}

// Insert vectors into an index
async function insertVectors(indexName, vectors) {
  return callCloudflareAPI(`indexes/${indexName}/vectors`, 'POST', {
    vectors
  });
}

// Query vectors in an index
async function queryVectors(indexName, vector, topK = 5) {
  return callCloudflareAPI(`indexes/${indexName}/query`, 'POST', {
    vector,
    topK,
    returnValues: false,
    returnMetadata: true
  });
}

// Get all vectors in an index
async function getVectors(indexName) {
  return callCloudflareAPI(`indexes/${indexName}/vectors`);
}

// Delete vectors from an index
async function deleteVectors(indexName, ids) {
  return callCloudflareAPI(`indexes/${indexName}/vectors/delete`, 'POST', {
    ids
  });
}

// Main test function
async function runTest() {
  try {
    console.log('Testing Cloudflare Vectorize API...');
    
    // Check if our index exists
    console.log(`\nChecking for index: ${VECTORIZE_INDEX_NAME}`);
    try {
      const index = await getIndex(VECTORIZE_INDEX_NAME);
      console.log('Index found:', index);
    } catch (error) {
      console.log('Index not found, creating it...');
      const newIndex = await createIndex(VECTORIZE_INDEX_NAME, 32, 'cosine');
      console.log('Index created:', newIndex);
    }
    
    // Insert test vectors
    console.log('\nInserting test vectors...');
    const vectors = testData.map(item => ({
      id: item.id,
      values: stringToVector(item.text),
      metadata: { 
        text: item.text,
        category: item.category
      }
    }));
    
    const insertResult = await insertVectors(VECTORIZE_INDEX_NAME, vectors);
    console.log('Insert result:', insertResult);
    
    // Query for similar vectors
    console.log('\nQuerying for vectors similar to "hello"...');
    const queryVector = stringToVector('hello');
    const queryResult = await queryVectors(VECTORIZE_INDEX_NAME, queryVector);
    console.log('Query result:', queryResult);
    
    // Format and display matches
    if (queryResult.matches && queryResult.matches.length > 0) {
      console.log('\nMatches:');
      queryResult.matches.forEach(match => {
        console.log(`- ID: ${match.id}, Score: ${match.score}, Text: ${match.metadata.text}`);
      });
    }
    
    // List all vectors
    console.log('\nListing all vectors...');
    const allVectors = await getVectors(VECTORIZE_INDEX_NAME);
    console.log(`Found ${allVectors.length} vectors`);
    
    // Clean up (optional)
    const shouldCleanup = false; // Set to true to delete test vectors
    if (shouldCleanup) {
      console.log('\nCleaning up test vectors...');
      const ids = vectors.map(v => v.id);
      const deleteResult = await deleteVectors(VECTORIZE_INDEX_NAME, ids);
      console.log('Delete result:', deleteResult);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
runTest();
