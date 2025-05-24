/**
 * Simple encryption utilities for OAuth cookie handling
 */

// Use the built-in WebCrypto types instead of declaring our own
// This approach is more compatible with the Cloudflare Workers environment

// Define the CryptoKey type for TypeScript compatibility
type CryptoKey = any;

/**
 * Encrypt a string using a secret key
 * This is a simple implementation for cookie encryption
 */
export async function encrypt(data: string, key: string): Promise<string> {
  // Create a key from the secret
  const cryptoKey = await createKey(key);
  
  // Generate a random IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encode the data
  const encodedData = new TextEncoder().encode(data);
  
  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encodedData
  );
  
  // Combine IV and encrypted data
  const result = new Uint8Array(iv.length + encryptedData.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert to base64 for storage
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypt a string using a secret key
 */
export async function decrypt(encryptedData: string, key: string): Promise<string> {
  try {
    // Create a key from the secret
    const cryptoKey = await createKey(key);
    
    // Decode from base64
    const data = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(char => char.charCodeAt(0))
    );
    
    // Extract IV and encrypted data
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    
    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );
    
    // Decode and return
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Create a CryptoKey from a string
 */
async function createKey(key: string): Promise<CryptoKey> {
  // Create a consistent key from the string
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  
  // Hash the key to ensure it's the right length
  const hashedKey = await crypto.subtle.digest('SHA-256', keyData);
  
  // Import the key
  return crypto.subtle.importKey(
    'raw',
    hashedKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}
