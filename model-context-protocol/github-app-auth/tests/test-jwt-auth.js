/**
 * Simple test script for JWT authentication
 * 
 * This script tests the JWT authentication flow by:
 * 1. Starting the GitHub OAuth flow
 * 2. Checking authentication status
 * 3. Verifying the JWT token is returned
 * 4. Using the JWT token to access protected endpoints
 */

import fetch from 'node-fetch';
import open from 'open';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const API_BASE_URL = 'http://localhost:8787';
let sessionId = null;
let githubUserId = null;
let authToken = null; // JWT token
let isComplete = false;

/**
 * Prompt the user for input
 */
function prompt(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Start the GitHub OAuth flow
 */
async function startAuth() {
  console.log('\nStarting GitHub authentication flow...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/start`);
    const data = await response.json();
    
    sessionId = data.sessionId;
    const authUrl = data.authUrl;
    
    console.log('\n🔐 Please authenticate with GitHub by visiting this URL:\n');
    console.log(authUrl);
    console.log('\n');
    
    const answer = await prompt('Would you like to open this URL in your browser? (y/n): ');
    if (answer.toLowerCase() === 'y') {
      await open(authUrl);
      console.log('Browser opened. Please complete the authentication in your browser.');
    }
    
    console.log('\nWaiting for authentication to complete...');
    await checkAuthStatus();
  } catch (error) {
    console.error('Error starting authentication:', error);
  }
}

/**
 * Check the authentication status
 */
async function checkAuthStatus() {
  if (!sessionId) {
    console.error('No session ID available.');
    return;
  }
  
  console.log('Checking authentication status...');
  console.log('Session ID:', sessionId);
  
  while (!isComplete) {
    try {
      const response = await fetch(`${API_BASE_URL}/status/${sessionId}`);
      const data = await response.json();
      
      console.log('Status response:', JSON.stringify(data, null, 2));
      
      if (data.status === 'complete' && data.userId) {
        isComplete = true;
        githubUserId = data.userId;
        authToken = data.token; // Store the JWT token
        
        console.log('\n✅ Authentication complete!');
        console.log('GitHub User ID:', githubUserId);
        console.log('JWT Token received:', authToken ? 'Yes' : 'No');
        
        if (authToken) {
          console.log('\nJWT token details:');
          // Print the first part of the token (header)
          const [header] = authToken.split('.');
          const decodedHeader = Buffer.from(header, 'base64').toString();
          console.log('Header:', decodedHeader);
          
          // Test the token by getting domains
          await getDomains();
        } else {
          console.log('\n❌ No JWT token received. Authentication may not be complete.');
        }
        
        break;
      } else {
        console.log(`Authentication ${data.status}... (waiting 2 seconds)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error('Error checking authentication status:', error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

/**
 * Get the user's whitelisted domains using JWT authentication
 */
async function getDomains() {
  if (!githubUserId) {
    console.error('No GitHub user ID available.');
    return;
  }
  
  if (!authToken) {
    console.error('No JWT token available for authentication.');
    return;
  }
  
  console.log('\nTesting JWT authentication by getting domains...');
  
  try {
    // Use JWT token in Authorization header
    const response = await fetch(`${API_BASE_URL}/api/user/${githubUserId}/domains`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get domains: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('\n✅ Successfully accessed protected endpoint using JWT token!');
    console.log('Domains:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('\n❌ Error getting domains with JWT token:', error.message);
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🧪 JWT Authentication Test');
  console.log('==========================\n');
  console.log('This test verifies that JWT tokens are correctly generated and used for authentication.');
  
  await startAuth();
  
  rl.close();
}

// Run the test
main().catch(error => {
  console.error('Test failed:', error);
  rl.close();
});
