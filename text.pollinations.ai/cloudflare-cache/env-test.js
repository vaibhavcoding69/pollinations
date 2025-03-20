// Test script to verify dotenv loading
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

// Try to load from .env file with explicit path
const result = dotenv.config({ path: envPath });
console.log('dotenv load result:', result);

// Check environment variables
console.log('CLOUDFLARE_API_TOKEN:', process.env.CLOUDFLARE_API_TOKEN ? 'defined' : 'undefined');
console.log('CLOUDFLARE_ACCOUNT_ID:', process.env.CLOUDFLARE_ACCOUNT_ID ? 'defined' : 'undefined');

// List all environment variables (keys only, for security)
console.log('\nAll environment variables (keys only):');
console.log(Object.keys(process.env));
