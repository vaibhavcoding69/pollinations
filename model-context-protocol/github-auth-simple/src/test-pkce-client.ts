/**
 * Test client for OAuth 2.1 with PKCE flow
 * This client demonstrates how to properly implement the PKCE flow for OAuth 2.1
 */

// HTML template for the test client
export const TEST_PKCE_CLIENT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OAuth 2.1 PKCE Test Client</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 {
      color: #333;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    .card {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    button {
      background: #0070f3;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
      margin-right: 10px;
    }
    button:hover {
      background: #0051a8;
    }
    button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    pre {
      background: #f1f1f1;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      white-space: pre-wrap;
    }
    .success {
      color: #00a854;
      font-weight: bold;
    }
    .error {
      color: #f5222d;
      font-weight: bold;
    }
    .info {
      color: #1890ff;
      font-weight: bold;
    }
    input, select {
      width: 100%;
      padding: 8px;
      margin: 8px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    label {
      font-weight: bold;
    }
    .flow-step {
      margin-bottom: 10px;
      padding: 10px;
      border-left: 3px solid #1890ff;
      background: #f0f8ff;
    }
  </style>
</head>
<body>
  <h1>OAuth 2.1 PKCE Test Client</h1>
  
  <div class="card">
    <h2>Configuration</h2>
    <div>
      <label for="auth-server">Authorization Server:</label>
      <input type="text" id="auth-server" value="http://localhost:3000" />
    </div>
    <div>
      <label for="redirect-uri">Redirect URI:</label>
      <input type="text" id="redirect-uri" value="http://localhost:3000/test-pkce-client" />
    </div>
    <div>
      <label for="client-id">Client ID (optional):</label>
      <input type="text" id="client-id" placeholder="Leave empty to use server's default client ID" />
    </div>
  </div>
  
  <div class="card">
    <h2>OAuth 2.1 with PKCE Flow</h2>
    <p>This client demonstrates the OAuth 2.1 Authorization Code flow with PKCE (Proof Key for Code Exchange).</p>
    
    <div class="flow-step">
      <strong>Step 1:</strong> Generate PKCE code verifier and challenge
      <button id="generate-pkce">Generate PKCE Parameters</button>
      <div id="pkce-params"></div>
    </div>
    
    <div class="flow-step">
      <strong>Step 2:</strong> Initiate authorization request
      <button id="start-auth" disabled>Start Authorization</button>
    </div>
    
    <div class="flow-step">
      <strong>Step 3:</strong> Exchange code for token (happens automatically after redirect)
      <div id="token-result"></div>
    </div>
    
    <div class="flow-step">
      <strong>Step 4:</strong> Use token to access protected resources
      <button id="get-user" disabled>Get User Info</button>
      <div id="user-info"></div>
    </div>
  </div>
  
  <div class="card">
    <h2>Domain Allowlist Management</h2>
    <div>
      <label for="domain">Domain:</label>
      <input type="text" id="domain" placeholder="example.com" />
      <button id="add-domain" disabled>Add Domain</button>
      <button id="remove-domain" disabled>Remove Domain</button>
    </div>
    <div>
      <button id="get-domains" disabled>Get Domains</button>
      <div id="domains-list"></div>
    </div>
  </div>
  
  <div class="card">
    <h2>Log</h2>
    <pre id="log"></pre>
    <button id="clear-log">Clear Log</button>
  </div>

  <script>
    // Store state and PKCE parameters
    let state = '';
    let codeVerifier = '';
    let codeChallenge = '';
    let accessToken = '';
    
    // DOM elements
    const authServerInput = document.getElementById('auth-server');
    const redirectUriInput = document.getElementById('redirect-uri');
    const clientIdInput = document.getElementById('client-id');
    const generatePkceBtn = document.getElementById('generate-pkce');
    const startAuthBtn = document.getElementById('start-auth');
    const getUserBtn = document.getElementById('get-user');
    const addDomainBtn = document.getElementById('add-domain');
    const removeDomainBtn = document.getElementById('remove-domain');
    const getDomainsBtn = document.getElementById('get-domains');
    const clearLogBtn = document.getElementById('clear-log');
    const pkceParamsDiv = document.getElementById('pkce-params');
    const tokenResultDiv = document.getElementById('token-result');
    const userInfoDiv = document.getElementById('user-info');
    const domainsListDiv = document.getElementById('domains-list');
    const logPre = document.getElementById('log');
    const domainInput = document.getElementById('domain');
    
    // Helper functions
    function log(message, type = 'info') {
      const timestamp = new Date().toISOString();
      const entry = \`[\${timestamp}] [\${type.toUpperCase()}] \${message}\`;
      logPre.textContent = entry + '\\n' + logPre.textContent;
    }
    
    function base64UrlEncode(buffer) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)))
        .replace(/\\+/g, '-')
        .replace(/\\//g, '_')
        .replace(/=+$/, '');
    }
    
    async function generatePkceParams() {
      // Generate a random code verifier
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      codeVerifier = base64UrlEncode(array);
      
      // Generate code challenge using SHA-256
      const encoder = new TextEncoder();
      const data = encoder.encode(codeVerifier);
      const digest = await window.crypto.subtle.digest('SHA-256', data);
      codeChallenge = base64UrlEncode(digest);
      
      // Generate state
      const stateArray = new Uint8Array(16);
      window.crypto.getRandomValues(stateArray);
      state = base64UrlEncode(stateArray);
      
      return { codeVerifier, codeChallenge, state };
    }
    
    // Check if we're returning from an authorization redirect
    function handleAuthorizationResponse() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      const error = params.get('error');
      const returnedState = params.get('state');
      
      if (error) {
        log(\`Authorization error: \${error}\`, 'error');
        tokenResultDiv.innerHTML = \`<span class="error">Error: \${error}</span>\`;
        return;
      }
      
      if (token) {
        // Verify state if it exists in localStorage
        const savedState = localStorage.getItem('pkce_state');
        if (savedState && returnedState !== savedState) {
          log('State mismatch! Possible CSRF attack.', 'error');
          tokenResultDiv.innerHTML = '<span class="error">State mismatch! Authentication failed.</span>';
          return;
        }
        
        accessToken = token;
        log('Received access token', 'success');
        tokenResultDiv.innerHTML = \`<span class="success">Token received!</span>\`;
        
        // Enable user info and domain management buttons
        getUserBtn.disabled = false;
        addDomainBtn.disabled = false;
        removeDomainBtn.disabled = false;
        getDomainsBtn.disabled = false;
        
        // Clean up URL parameters
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
    
    // Event listeners
    generatePkceBtn.addEventListener('click', async () => {
      try {
        const { codeVerifier, codeChallenge, state } = await generatePkceParams();
        
        // Save state and code verifier for later use
        localStorage.setItem('pkce_state', state);
        localStorage.setItem('pkce_code_verifier', codeVerifier);
        
        pkceParamsDiv.innerHTML = \`
          <pre>
Code Verifier: \${codeVerifier.substring(0, 24)}...
Code Challenge: \${codeChallenge.substring(0, 24)}...
State: \${state}
          </pre>
        \`;
        
        log('Generated PKCE parameters', 'success');
        startAuthBtn.disabled = false;
      } catch (error) {
        log(\`Error generating PKCE parameters: \${error.message}\`, 'error');
      }
    });
    
    startAuthBtn.addEventListener('click', () => {
      const authServer = authServerInput.value.trim();
      const redirectUri = redirectUriInput.value.trim();
      const clientId = clientIdInput.value.trim();
      
      if (!authServer) {
        log('Authorization server URL is required', 'error');
        return;
      }
      
      if (!redirectUri) {
        log('Redirect URI is required', 'error');
        return;
      }
      
      // Get saved PKCE parameters
      const savedState = localStorage.getItem('pkce_state');
      const savedCodeVerifier = localStorage.getItem('pkce_code_verifier');
      
      if (!savedState || !savedCodeVerifier) {
        log('PKCE parameters not found. Generate them first.', 'error');
        return;
      }
      
      // Construct authorization URL
      const authUrl = new URL(\`\${authServer}/authorize\`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('state', savedState);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      
      if (clientId) {
        authUrl.searchParams.set('client_id', clientId);
      }
      
      log(\`Redirecting to authorization endpoint: \${authUrl}\`, 'info');
      window.location.href = authUrl.toString();
    });
    
    getUserBtn.addEventListener('click', async () => {
      if (!accessToken) {
        log('No access token available', 'error');
        return;
      }
      
      try {
        const authServer = authServerInput.value.trim();
        const response = await fetch(\`\${authServer}/user\`, {
          headers: {
            'Authorization': \`Bearer \${accessToken}\`
          }
        });
        
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        const userData = await response.json();
        userInfoDiv.innerHTML = \`<pre>\${JSON.stringify(userData, null, 2)}</pre>\`;
        log('Retrieved user info', 'success');
      } catch (error) {
        log(\`Error getting user info: \${error.message}\`, 'error');
        userInfoDiv.innerHTML = \`<span class="error">Error: \${error.message}</span>\`;
      }
    });
    
    addDomainBtn.addEventListener('click', async () => {
      const domain = domainInput.value.trim();
      if (!domain) {
        log('Domain is required', 'error');
        return;
      }
      
      if (!accessToken) {
        log('No access token available', 'error');
        return;
      }
      
      try {
        const authServer = authServerInput.value.trim();
        const response = await fetch(\`\${authServer}/domains\`, {
          method: 'POST',
          headers: {
            'Authorization': \`Bearer \${accessToken}\`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ domain })
        });
        
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        log(\`Added domain: \${domain}\`, 'success');
        domainInput.value = '';
        
        // Refresh domains list
        getDomainsBtn.click();
      } catch (error) {
        log(\`Error adding domain: \${error.message}\`, 'error');
      }
    });
    
    removeDomainBtn.addEventListener('click', async () => {
      const domain = domainInput.value.trim();
      if (!domain) {
        log('Domain is required', 'error');
        return;
      }
      
      if (!accessToken) {
        log('No access token available', 'error');
        return;
      }
      
      try {
        const authServer = authServerInput.value.trim();
        const response = await fetch(\`\${authServer}/domains/\${encodeURIComponent(domain)}\`, {
          method: 'DELETE',
          headers: {
            'Authorization': \`Bearer \${accessToken}\`
          }
        });
        
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        log(\`Removed domain: \${domain}\`, 'success');
        domainInput.value = '';
        
        // Refresh domains list
        getDomainsBtn.click();
      } catch (error) {
        log(\`Error removing domain: \${error.message}\`, 'error');
      }
    });
    
    getDomainsBtn.addEventListener('click', async () => {
      if (!accessToken) {
        log('No access token available', 'error');
        return;
      }
      
      try {
        const authServer = authServerInput.value.trim();
        const response = await fetch(\`\${authServer}/domains\`, {
          headers: {
            'Authorization': \`Bearer \${accessToken}\`
          }
        });
        
        if (!response.ok) {
          throw new Error(\`HTTP error! status: \${response.status}\`);
        }
        
        const domainsData = await response.json();
        
        if (domainsData.domains && domainsData.domains.length > 0) {
          domainsListDiv.innerHTML = \`
            <h3>Your Domains:</h3>
            <ul>
              \${domainsData.domains.map(domain => \`<li>\${domain}</li>\`).join('')}
            </ul>
          \`;
        } else {
          domainsListDiv.innerHTML = '<p>No domains in your allowlist.</p>';
        }
        
        log('Retrieved domains list', 'success');
      } catch (error) {
        log(\`Error getting domains: \${error.message}\`, 'error');
        domainsListDiv.innerHTML = \`<span class="error">Error: \${error.message}</span>\`;
      }
    });
    
    clearLogBtn.addEventListener('click', () => {
      logPre.textContent = '';
      log('Log cleared', 'info');
    });
    
    // Initialize
    window.addEventListener('DOMContentLoaded', () => {
      log('PKCE Test Client initialized', 'info');
      handleAuthorizationResponse();
    });
  </script>
</body>
</html>`;

// Handler for the test client
export async function handleTestPkceClient(request: Request): Promise<Response> {
  return new Response(TEST_PKCE_CLIENT_HTML, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}
