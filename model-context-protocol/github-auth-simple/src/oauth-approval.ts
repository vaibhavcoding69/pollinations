import { encrypt, decrypt } from './crypto';

// Cookie name for storing approved client IDs
const APPROVAL_COOKIE = "pollinations-approved-clients";

/**
 * Check if the client ID has already been approved by the user
 */
export async function clientIdAlreadyApproved(
  request: Request,
  clientId: string,
  encryptionKey: string
): Promise<boolean> {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`${APPROVAL_COOKIE}=([^;]+)`));
  if (!match) return false;

  try {
    const encryptedValue = match[1];
    const decryptedValue = await decrypt(encryptedValue, encryptionKey);
    const approvedClients = JSON.parse(decryptedValue);
    return approvedClients.includes(clientId);
  } catch (e) {
    console.error("Error checking approved clients:", e);
    return false;
  }
}

/**
 * Parse the approval form submission and generate cookies for future approvals
 */
export async function parseRedirectApproval(
  request: Request,
  encryptionKey: string
): Promise<{ state: any; headers: Record<string, string> }> {
  const formData = await request.formData();
  const approved = formData.get("approved") === "true";
  const stateJson = formData.get("state");
  
  if (!stateJson) {
    throw new Error("Missing state in form submission");
  }
  
  const state = JSON.parse(stateJson.toString());
  const headers: Record<string, string> = {};
  
  if (approved && state.clientId) {
    // Get existing approved clients
    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(new RegExp(`${APPROVAL_COOKIE}=([^;]+)`));
    let approvedClients: string[] = [];
    
    if (match) {
      try {
        const decryptedValue = await decrypt(match[1], encryptionKey);
        approvedClients = JSON.parse(decryptedValue);
      } catch (e) {
        console.error("Error parsing existing approved clients:", e);
      }
    }
    
    // Add the new client ID if not already present
    if (!approvedClients.includes(state.clientId)) {
      approvedClients.push(state.clientId);
    }
    
    // Encrypt and set the cookie
    const encryptedValue = await encrypt(JSON.stringify(approvedClients), encryptionKey);
    headers["Set-Cookie"] = `${APPROVAL_COOKIE}=${encryptedValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`;
  }
  
  return { state, headers };
}

/**
 * Render the OAuth approval dialog
 */
export function renderApprovalDialog(
  request: Request,
  options: {
    client: any;
    server: {
      name: string;
      logo: string;
      description?: string;
    };
    state: any;
  }
): Response {
  const { client, server, state } = options;
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize ${client.clientName || "Application"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .container {
      background: #f9f9f9;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
    }
    .logo {
      width: 50px;
      height: 50px;
      margin-right: 15px;
      border-radius: 8px;
    }
    h1 {
      font-size: 24px;
      margin: 0;
    }
    .client-info {
      display: flex;
      align-items: center;
      margin: 20px 0;
      padding: 15px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #eee;
    }
    .client-logo {
      width: 40px;
      height: 40px;
      margin-right: 15px;
      border-radius: 6px;
    }
    .scope-list {
      margin: 20px 0;
    }
    .buttons {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 30px;
    }
    .btn {
      padding: 10px 16px;
      border-radius: 6px;
      border: none;
      font-size: 16px;
      cursor: pointer;
    }
    .btn-approve {
      background: #0070f3;
      color: white;
    }
    .btn-deny {
      background: #f5f5f5;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${server.logo}" alt="${server.name}" class="logo">
      <h1>${server.name}</h1>
    </div>
    
    ${server.description ? `<p>${server.description}</p>` : ''}
    
    <p><strong>${client.clientName || "An application"}</strong> is requesting access to your GitHub account.</p>
    
    <div class="client-info">
      ${client.logoUri ? `<img src="${client.logoUri}" alt="${client.clientName}" class="client-logo">` : ''}
      <div>
        <strong>${client.clientName || "Application"}</strong>
        ${client.clientUri ? `<div><a href="${client.clientUri}" target="_blank">${client.clientUri}</a></div>` : ''}
      </div>
    </div>
    
    <div class="scope-list">
      <p>This will allow the application to:</p>
      <ul>
        <li>Access your GitHub profile information</li>
        <li>Verify your identity</li>
        <li>Manage your domain allowlist</li>
      </ul>
    </div>
    
    <form method="POST">
      <input type="hidden" name="state" value='${JSON.stringify(state)}'>
      <div class="buttons">
        <button type="submit" name="approved" value="false" class="btn btn-deny">Deny</button>
        <button type="submit" name="approved" value="true" class="btn btn-approve">Authorize</button>
      </div>
    </form>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}
