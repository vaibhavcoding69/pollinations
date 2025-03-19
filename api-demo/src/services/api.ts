import axios from 'axios';

// Configurable API settings
export const ApiConfig = {
  useLocalApi: false,
  textPort: '16385',
  imagePort: '16384'
};

// Function to get the appropriate base URLs based on current configuration
export const getApiBaseUrls = () => {
  if (ApiConfig.useLocalApi) {
    return {
      TEXT_API_BASE: `http://localhost:${ApiConfig.textPort}`,
      IMAGE_API_BASE: `http://localhost:${ApiConfig.imagePort}`
    };
  } else {
    return {
      TEXT_API_BASE: 'https://text.pollinations.ai',
      IMAGE_API_BASE: 'https://image.pollinations.ai'
    };
  }
};

// Get current API Base URLs
const { TEXT_API_BASE, IMAGE_API_BASE } = getApiBaseUrls();

// Define types for the API responses
export interface TextModel {
  name: string;
  description: string;
  handler?: any;
  details?: string;
  provider?: string;
  censored?: boolean;
  input_modalities?: string[];
  output_modalities?: string[];
  reasoning?: boolean;
  vision?: boolean;
  audio?: boolean;
  voices?: string[];
  type?: string; // For backward compatibility
  baseModel?: boolean; // For backward compatibility
  maxTokens?: number; // For backward compatibility
}

// Simple string type for image models
export type ImageModel = string;

// Function to fetch text models
export const fetchTextModels = async (): Promise<TextModel[]> => {
  const { TEXT_API_BASE } = getApiBaseUrls();
  const response = await axios.get(`${TEXT_API_BASE}/models`);
  return response.data;
};

// Function to fetch image models
export const fetchImageModels = async (): Promise<string[]> => {
  const { IMAGE_API_BASE } = getApiBaseUrls();
  const response = await axios.get(`${IMAGE_API_BASE}/models`);
  return response.data;
};

// Define parameter types for each endpoint
export interface TextParams {
  prompt: string;
  model?: string;
  seed?: number;
  json?: boolean;
  system?: string;
  private?: boolean;
  voice?: string;
}

// Interface for message content structure
export type MessageContent = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// Interface for OpenAI-style message format
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string | MessageContent[];
}

// Interface for POST request body to text API
export interface TextPostParams {
  messages: Message[];
  model: string;
  seed?: number;
  jsonMode?: boolean;
  private?: boolean;
  voice?: string;
  stream?: boolean;
}

export interface ImageParams {
  prompt: string;
  model?: string;
  seed?: number;
  width?: number;
  height?: number;
  nologo?: boolean;
  private?: boolean;
  enhance?: boolean;
  safe?: boolean;
}

// Function to build text API URL
export const buildTextApiUrl = (params: TextParams): string => {
  const { TEXT_API_BASE } = getApiBaseUrls();
  const baseUrl = TEXT_API_BASE;
  const queryParams = new URLSearchParams();
  
  // Handle required prompt parameter
  const encodedPrompt = encodeURIComponent(params.prompt);
  
  // Add optional parameters if they exist
  if (params.model) queryParams.append('model', params.model);
  if (params.seed !== undefined) queryParams.append('seed', params.seed.toString());
  if (params.json) queryParams.append('json', 'true');
  if (params.system) queryParams.append('system', encodeURIComponent(params.system));
  if (params.private) queryParams.append('private', 'true');
  if (params.voice) queryParams.append('voice', params.voice);
  
  const queryString = queryParams.toString();
  return `${baseUrl}/${encodedPrompt}${queryString ? `?${queryString}` : ''}`;
};

// Function to make POST request to text API
export const makeTextPostRequest = async (params: TextPostParams) => {
  const { TEXT_API_BASE } = getApiBaseUrls();
  const url = `${TEXT_API_BASE}/`;
  const response = await axios.post(url, params);
  return response.data;
};

// Function to build image API URL
export const buildImageApiUrl = (params: ImageParams): string => {
  const { IMAGE_API_BASE } = getApiBaseUrls();
  const baseUrl = `${IMAGE_API_BASE}/prompt`;
  const queryParams = new URLSearchParams();
  
  // Handle required prompt parameter
  const encodedPrompt = encodeURIComponent(params.prompt);
  
  // Add optional parameters if they exist
  if (params.model) queryParams.append('model', params.model);
  if (params.seed !== undefined) queryParams.append('seed', params.seed.toString());
  if (params.width) queryParams.append('width', params.width.toString());
  if (params.height) queryParams.append('height', params.height.toString());
  if (params.nologo) queryParams.append('nologo', 'true');
  if (params.private) queryParams.append('private', 'true');
  if (params.enhance) queryParams.append('enhance', 'true');
  if (params.safe) queryParams.append('safe', 'true');
  
  const queryString = queryParams.toString();
  return `${baseUrl}/${encodedPrompt}${queryString ? `?${queryString}` : ''}`;
}; 