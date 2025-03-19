import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  TextField, 
  MenuItem, 
  Select, 
  FormControl, 
  InputLabel,
  Grid,
  Paper,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Chip,
  Tabs,
  Tab,
  Checkbox,
  ListItemText,
  OutlinedInput,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  CardContent,
  ButtonGroup
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StorageIcon from '@mui/icons-material/Storage';
import CloudIcon from '@mui/icons-material/Cloud';
import TextFormatIcon from '@mui/icons-material/TextFormat';
import ImageIcon from '@mui/icons-material/Image';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import HeadsetIcon from '@mui/icons-material/Headset';
import PhotoIcon from '@mui/icons-material/Photo';
import PostAddIcon from '@mui/icons-material/PostAdd';
import GetAppIcon from '@mui/icons-material/GetApp';
import axios from 'axios';
import { 
  TextModel, 
  fetchTextModels, 
  fetchImageModels,
  TextParams,
  ImageParams,
  buildTextApiUrl,
  buildImageApiUrl,
  makeTextPostRequest,
  Message,
  MessageContent,
  TextPostParams,
  ApiConfig
} from '../services/api';

// Define endpoint options (keeping for backward compatibility)
const endpoints = [
  { value: 'text', label: 'Text API' },
  { value: 'image', label: 'Image API' }
];

// Fallback models when the API is not available
const FALLBACK_IMAGE_MODELS = [
  'sd3',
  'sdxl',
  'kandinsky',
  'dalle',
  'pixart',
  'deepfloyd'
];

// Helper function to extract unique modalities from models
const extractUniqueModalities = (models: TextModel[], type: 'input' | 'output'): string[] => {
  const modalitiesSet = new Set<string>();
  
  models.forEach(model => {
    const modalities = type === 'input' 
      ? model.input_modalities || [] 
      : model.output_modalities || [];
      
    modalities.forEach(modality => modalitiesSet.add(modality));
  });
  
  return Array.from(modalitiesSet).sort();
};

// Helper function to find modalities that are supported by ALL models
const findUniversalModalities = (models: TextModel[], type: 'input' | 'output'): string[] => {
  if (models.length === 0) return [];
  
  // Get all unique modalities first
  const allModalities = extractUniqueModalities(models, type);
  
  // Filter to keep only modalities that exist in ALL models
  return allModalities.filter(modality => {
    return models.every(model => {
      const modelModalities = type === 'input' 
        ? model.input_modalities || [] 
        : model.output_modalities || [];
      return modelModalities.includes(modality);
    });
  });
};

// Interface for TabPanel props
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// TabPanel component to show content for each tab
const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

// Function to get props for tabs
const a11yProps = (index: number) => {
  return {
    id: `api-tab-${index}`,
    'aria-controls': `api-tabpanel-${index}`,
  };
};

// Configure axios defaults
axios.defaults.timeout = 30000; // 30 seconds timeout

// ModelProperties component to display model details
const ModelProperties: React.FC<{ model: TextModel | null }> = ({ model }) => {
  if (!model) return null;
  
  // Skip these properties when displaying
  const skipProps = ['name', 'description', 'handler'];
  
  return (
    <Paper elevation={1} sx={{ p: 2, mt: 2, backgroundColor: 'rgba(0, 0, 0, 0.04)' }}>
      <Grid container spacing={1}>
        {Object.entries(model).map(([key, value]) => {
          // Skip certain properties
          if (skipProps.includes(key) || value === undefined) return null;
          
          // Format the value based on its type
          let formattedValue = value;
          if (Array.isArray(value)) {
            formattedValue = value.join(', ');
          } else if (typeof value === 'boolean') {
            formattedValue = value ? 'Yes' : 'No';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value);
          }
          
          return (
            <Grid item xs={6} key={key}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', mr: 1 }}>
                  {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:
                </Typography>
                <Typography variant="caption">
                  {formattedValue}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Paper>
  );
};

const ApiConfigurator: React.FC = () => {
  // Tab selection state
  const [tabValue, setTabValue] = useState<number>(0);
  
  // State for endpoint selection (keeping for backward compatibility)
  const [endpoint, setEndpoint] = useState<'text' | 'image'>('text');
  
  // State for models
  const [textModels, setTextModels] = useState<TextModel[]>([]);
  const [filteredTextModels, setFilteredTextModels] = useState<TextModel[]>([]);
  const [imageModels, setImageModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedModelDetails, setSelectedModelDetails] = useState<TextModel | null>(null);
  
  // State for filter modalities
  const [availableInputModalities, setAvailableInputModalities] = useState<string[]>([]);
  const [availableOutputModalities, setAvailableOutputModalities] = useState<string[]>([]);
  const [selectedInputModalities, setSelectedInputModalities] = useState<string[]>([]);
  const [selectedOutputModalities, setSelectedOutputModalities] = useState<string[]>([]);
  
  // State for parameters
  const [prompt, setPrompt] = useState<string>('');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);
  const [nologo, setNologo] = useState<boolean>(false);
  const [privateMode, setPrivateMode] = useState<boolean>(false);
  const [enhance, setEnhance] = useState<boolean>(false);
  const [safe, setSafe] = useState<boolean>(false);
  const [json, setJson] = useState<boolean>(false);
  const [system, setSystem] = useState<string>('');
  const [voice, setVoice] = useState<string>('');
  
  // State for API URL
  const [apiUrl, setApiUrl] = useState<string>('');
  
  // State for loading
  const [loading, setLoading] = useState<boolean>(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  
  // State for response
  const [response, setResponse] = useState<any>(null);
  const [imageResponse, setImageResponse] = useState<string | null>(null);
  const [fetchingResponse, setFetchingResponse] = useState<boolean>(false);
  const [responseError, setResponseError] = useState<string | null>(null);
  
  // State for notifications
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('success');
  
  // State for universal modalities (supported by all models)
  const [universalInputModalities, setUniversalInputModalities] = useState<string[]>([]);
  const [universalOutputModalities, setUniversalOutputModalities] = useState<string[]>([]);
  
  // State for API method (GET or POST)
  const [textApiMethod, setTextApiMethod] = useState<'GET' | 'POST'>('GET');
  
  // State for POST method message structure
  const [messages, setMessages] = useState<Message[]>([
    { role: 'user', content: '' }
  ]);

  // State for image URLs in messages
  const [imageUrls, setImageUrls] = useState<{[index: number]: string}>({});
  
  // State for API mode (local or production)
  const [useLocalApi, setUseLocalApi] = useState<boolean>(false);
  
  // Updated useEffect for endpoint changes
  useEffect(() => {
    fetchModels();
    
    // Clear responses when changing endpoints
    setResponse(null);
    setImageResponse(null);
    setResponseError(null);
  }, [endpoint]);
  
  // Update ApiConfig when local mode changes
  useEffect(() => {
    ApiConfig.useLocalApi = useLocalApi;
    
    // Clear responses when changing API mode
    setResponse(null);
    setImageResponse(null);
    setResponseError(null);
    
    // Refetch models when API mode changes
    if (endpoint) {
      const timer = setTimeout(() => {
        fetchModels();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [useLocalApi]);
  
  // Fetch models based on selected endpoint
  const fetchModels = async () => {
    setLoading(true);
    setModelsError(null);
    
    try {
      if (endpoint === 'text') {
        const models = await fetchTextModels();
        setTextModels(models);
        setFilteredTextModels(models); // Initially, show all models
        
        // Extract available modalities for filters
        const inputModalities = extractUniqueModalities(models, 'input');
        const outputModalities = extractUniqueModalities(models, 'output');
        
        // Find modalities supported by all models
        const universalInputMods = findUniversalModalities(models, 'input');
        const universalOutputMods = findUniversalModalities(models, 'output');
        
        setUniversalInputModalities(universalInputMods);
        setUniversalOutputModalities(universalOutputMods);
        
        setAvailableInputModalities(inputModalities);
        setAvailableOutputModalities(outputModalities);
        
        // Select all modalities by default
        setSelectedInputModalities(inputModalities);
        setSelectedOutputModalities(outputModalities);
        
        if (models.length > 0) {
          setSelectedModel(models[0].name);
          setSelectedModelDetails(models[0]);
        }
      } else {
        try {
          const models = await fetchImageModels();
          setImageModels(models);
          if (models.length > 0) {
            setSelectedModel(models[0]);
            setSelectedModelDetails(null); // Clear model details for image models
          }
        } catch (error) {
          console.error('Error fetching image models:', error);
          // Use fallback image models instead of showing an error
          setImageModels(FALLBACK_IMAGE_MODELS);
          setSelectedModel(FALLBACK_IMAGE_MODELS[0]);
          
          // Show a warning notification instead of an error
          showNotification('Unable to fetch image models. Using fallback models for preview.', 'warning');
          setModelsError('Could not connect to Image API. Using fallback models.');
        }
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelsError(`Failed to fetch ${endpoint} models. Please try again later.`);
      showNotification(`Failed to fetch ${endpoint} models`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Update endpoint based on tab
    setEndpoint(newValue === 0 ? 'text' : 'image');
    
    // Reset selected model when switching tabs to avoid out-of-range value errors
    setSelectedModel('');
  };
  
  // Filter text models based on selected modalities
  useEffect(() => {
    if (textModels.length === 0) return;
    
    let filtered = [...textModels];
    
    // Filter by input modalities if any are selected
    if (selectedInputModalities.length > 0) {
      filtered = filtered.filter(model => {
        const modelInputs = model.input_modalities || [];
        return selectedInputModalities.every(modality => 
          modelInputs.includes(modality)
        );
      });
    }
    
    // Filter by output modalities if any are selected
    if (selectedOutputModalities.length > 0) {
      filtered = filtered.filter(model => {
        const modelOutputs = model.output_modalities || [];
        return selectedOutputModalities.every(modality => 
          modelOutputs.includes(modality)
        );
      });
    }
    
    setFilteredTextModels(filtered);
    
    // Update selected model if the current one is filtered out
    if (filtered.length > 0 && !filtered.some(model => model.name === selectedModel)) {
      setSelectedModel(filtered[0].name);
      setSelectedModelDetails(filtered[0]);
    }
  }, [textModels, selectedInputModalities, selectedOutputModalities]);
  
  // Build API URL or POST body when parameters change
  useEffect(() => {
    if (textApiMethod === 'GET') {
      if (!prompt) {
        setApiUrl('');
        return;
      }
      
      if (endpoint === 'text') {
        const params: TextParams = {
          prompt,
          model: selectedModel,
          seed: seed,
          json,
          system,
          private: privateMode,
          voice: voice || undefined
        };
        setApiUrl(buildTextApiUrl(params));
      } else {
        const params: ImageParams = {
          prompt,
          model: selectedModel,
          seed,
          width,
          height,
          nologo,
          private: privateMode,
          enhance,
          safe
        };
        setApiUrl(buildImageApiUrl(params));
      }
    } else {
      // When using POST method, we don't build a URL but a representation of the request body
      if (endpoint === 'text' && messages.length > 0) {
        // Just set a placeholder for the apiUrl display
        setApiUrl(`${useLocalApi ? `http://localhost:${ApiConfig.textPort}` : 'https://text.pollinations.ai'} (POST request with ${messages.length} messages)`);
      }
    }
  }, [
    endpoint, prompt, selectedModel, seed, width, height, 
    nologo, privateMode, enhance, safe, json, system, voice,
    textApiMethod, messages, useLocalApi
  ]);
  
  // Handle endpoint change
  const handleEndpointChange = (event: SelectChangeEvent) => {
    setEndpoint(event.target.value as 'text' | 'image');
  };
  
  // Handle model change
  const handleModelChange = (event: SelectChangeEvent) => {
    const newModelName = event.target.value;
    setSelectedModel(newModelName);
    
    // Update model details if text endpoint
    if (endpoint === 'text') {
      const modelDetails = textModels.find(model => model.name === newModelName) || null;
      setSelectedModelDetails(modelDetails);
    } else {
      setSelectedModelDetails(null); // Clear for image models
    }
  };
  
  // Handle input modality selection change
  const handleInputModalityChange = (event: React.MouseEvent<HTMLElement>, newModalities: string[]) => {
    if (newModalities === null) return;
    
    // Make sure universal modalities remain selected
    const updatedModalities = [...universalInputModalities, ...newModalities.filter(m => !universalInputModalities.includes(m))];
    setSelectedInputModalities(updatedModalities);
  };
  
  // Handle output modality selection change
  const handleOutputModalityChange = (event: React.MouseEvent<HTMLElement>, newModalities: string[]) => {
    if (newModalities === null) return;
    
    // Make sure universal modalities remain selected
    const updatedModalities = [...universalOutputModalities, ...newModalities.filter(m => !universalOutputModalities.includes(m))];
    setSelectedOutputModalities(updatedModalities);
  };
  
  // Toggle all input modalities
  const toggleAllInputModalities = () => {
    if (selectedInputModalities.length === availableInputModalities.length) {
      // If all are selected, deselect all
      setSelectedInputModalities([]);
    } else {
      // Otherwise, select all
      setSelectedInputModalities([...availableInputModalities]);
    }
  };
  
  // Toggle all output modalities
  const toggleAllOutputModalities = () => {
    if (selectedOutputModalities.length === availableOutputModalities.length) {
      // If all are selected, deselect all
      setSelectedOutputModalities([]);
    } else {
      // Otherwise, select all
      setSelectedOutputModalities([...availableOutputModalities]);
    }
  };
  
  // Helper to show notifications
  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };
  
  // Handle copying the API URL
  const handleCopyUrl = () => {
    if (apiUrl) {
      navigator.clipboard.writeText(apiUrl)
        .then(() => {
          showNotification('API URL copied to clipboard!');
        })
        .catch(() => {
          showNotification('Failed to copy URL', 'error');
        });
    }
  };
  
  // Handle closing the snackbar
  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setSnackbarOpen(false);
  };
  
  // Safely parse JSON
  const safeJsonParse = (text: string | object) => {
    try {
      if (typeof text === 'object') {
        return JSON.stringify(text, null, 2);
      }
      return JSON.stringify(JSON.parse(text as string), null, 2);
    } catch (e) {
      console.error('Error parsing JSON:', e);
      return typeof text === 'object' ? 
        JSON.stringify(text, null, 2) : 
        (text as string);
    }
  };
  
  // Get error message from various error types
  const getErrorMessage = (error: any): string => {
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timed out. The server might be busy, please try again later.';
      }
      if (error.response) {
        // Server responded with a status code other than 2xx
        return `Server error: ${error.response.status} ${error.response.statusText}`;
      } else if (error.request) {
        // The request was made but no response was received
        return 'No response received from server. Please check your internet connection.';
      }
    }
    
    // Default error message
    return 'An unexpected error occurred. Please try again.';
  };
  
  // Toggle between GET and POST methods for text API
  const handleApiMethodChange = (
    event: React.MouseEvent<HTMLElement>,
    newMethod: 'GET' | 'POST' | null
  ) => {
    if (newMethod !== null) {
      setTextApiMethod(newMethod);
      
      // Reset response when changing methods
      setResponse(null);
      setResponseError(null);
      
      // Set initial messages when switching to POST
      if (newMethod === 'POST') {
        if (system) {
          setMessages([
            { role: 'system', content: system },
            { role: 'user', content: prompt }
          ]);
        } else {
          setMessages([{ role: 'user', content: prompt }]);
        }
        
        // Clear any previous image URLs
        setImageUrls({});
      }
    }
  };
  
  // Add a new message to the messages array
  const addMessage = (role: 'system' | 'user' | 'assistant') => {
    setMessages([...messages, { role, content: '' }]);
  };
  
  // Remove a message at the specified index
  const removeMessage = (index: number) => {
    setMessages(messages.filter((_, i) => i !== index));
    
    // Also remove any image URLs for this message
    if (imageUrls[index]) {
      const newImageUrls = { ...imageUrls };
      delete newImageUrls[index];
      setImageUrls(newImageUrls);
    }
  };
  
  // Update a message at the specified index
  const updateMessage = (index: number, content: string, isMultimodal = false) => {
    const newMessages = [...messages];
    
    // If it's a normal text update
    if (!isMultimodal) {
      newMessages[index] = { ...newMessages[index], content };
    } else {
      // For multimodal updates, we need to handle arrays of content
      let contentArray: MessageContent[];
      
      // If the existing content is a string, convert it to an array with text type
      if (typeof newMessages[index].content === 'string') {
        contentArray = [
          { type: 'text', text: newMessages[index].content as string }
        ];
      } else {
        contentArray = newMessages[index].content as MessageContent[];
      }
      
      // Find and update the text content
      const textContentIndex = contentArray.findIndex(item => item.type === 'text');
      if (textContentIndex >= 0) {
        contentArray[textContentIndex] = { type: 'text', text: content };
      } else {
        contentArray.push({ type: 'text', text: content });
      }
      
      newMessages[index] = { ...newMessages[index], content: contentArray };
    }
    
    setMessages(newMessages);
  };
  
  // Handle updating an image URL
  const handleImageUrlChange = (index: number, url: string) => {
    // Store the URL in the imageUrls state
    setImageUrls({ ...imageUrls, [index]: url });
    
    // If it's a data URL or complete URL, add it to the message immediately
    if (url && (url.startsWith('data:') || url.startsWith('http'))) {
      // Create proper structure for the message with image
      const newMessages = [...messages];
      let messageContent: MessageContent[];
      
      // Check if there's existing text content
      if (typeof newMessages[index].content === 'string') {
        // If it's a string, convert to a content array with text and image
        const textContent = newMessages[index].content as string;
        messageContent = [
          { type: 'text', text: textContent },
          { type: 'image_url', image_url: { url } }
        ];
      } else if (Array.isArray(newMessages[index].content)) {
        // If it's already an array, make a copy
        messageContent = [...(newMessages[index].content as MessageContent[])];
        
        // Update or add the image content
        const imageIndex = messageContent.findIndex(item => item.type === 'image_url');
        if (imageIndex >= 0) {
          messageContent[imageIndex] = { type: 'image_url', image_url: { url } };
        } else {
          messageContent.push({ type: 'image_url', image_url: { url } });
        }
      } else {
        // Fallback - just create new content array with image
        messageContent = [
          { type: 'text', text: '' },
          { type: 'image_url', image_url: { url } }
        ];
      }
      
      // Update the message with the new content structure
      newMessages[index] = {
        ...newMessages[index],
        content: messageContent
      };
      
      setMessages(newMessages);
      console.log("Updated messages with image:", newMessages[index]);
    }
  };
  
  // Function to transform Google Drive links or data URLs to usable image URLs
  const transformGoogleDriveUrl = (url: string): string => {
    // If it's already a data URL, return as is
    if (url.startsWith('data:')) {
      return url;
    }
    
    // Check if it's a Google Drive URL
    if (url.match(/drive\.google\.com\/file\/d\/([^/]+)/)) {
      // Extract the file ID
      const fileId = url.match(/drive\.google\.com\/file\/d\/([^/]+)/)![1];
      // Return direct link format
      return `https://drive.google.com/uc?export=view&id=${fileId}`;
    }
    
    // No transformation needed for other URLs
    return url;
  };
  
  // Confirm adding an image to a message
  const confirmAddImage = (index: number) => {
    if (imageUrls[index]) {
      // Transform Google Drive URLs to direct image URLs
      const transformedUrl = transformGoogleDriveUrl(imageUrls[index]);
      
      // Create proper structure for the message with image
      const newMessages = [...messages];
      let messageContent: MessageContent[];
      
      // Check if there's existing text content
      if (typeof newMessages[index].content === 'string') {
        // If it's a string, convert to a content array with text and image
        const textContent = newMessages[index].content as string;
        messageContent = [
          { type: 'text', text: textContent },
          { type: 'image_url', image_url: { url: transformedUrl } }
        ];
      } else if (Array.isArray(newMessages[index].content)) {
        // If it's already an array, make a copy
        messageContent = [...(newMessages[index].content as MessageContent[])];
        
        // Update or add the image content
        const imageIndex = messageContent.findIndex(item => item.type === 'image_url');
        if (imageIndex >= 0) {
          messageContent[imageIndex] = { type: 'image_url', image_url: { url: transformedUrl } };
        } else {
          messageContent.push({ type: 'image_url', image_url: { url: transformedUrl } });
        }
      } else {
        // Fallback - just create new content array with image
        messageContent = [
          { type: 'text', text: '' },
          { type: 'image_url', image_url: { url: transformedUrl } }
        ];
      }
      
      // Update the message with the new content structure
      newMessages[index] = {
        ...newMessages[index],
        content: messageContent
      };
      
      setMessages(newMessages);
      console.log("Confirmed image in message:", newMessages[index]);
    }
  };
  
  // Check if a message has an image
  const messageHasImage = (index: number): boolean => {
    const message = messages[index];
    if (typeof message.content === 'string') return false;
    
    const contentArray = message.content as MessageContent[];
    return contentArray.some(item => item.type === 'image_url');
  };
  
  // Fetch the response
  const fetchResponse = async () => {
    if (endpoint === 'text') {
      if (textApiMethod === 'GET' && !apiUrl) return;
      if (textApiMethod === 'POST' && (!messages.length || !selectedModel)) return;
    } else {
      if (!apiUrl) return;
    }
    
    setFetchingResponse(true);
    setResponseError(null);
    
    try {
      if (endpoint === 'text') {
        setImageResponse(null);
        
        if (textApiMethod === 'GET') {
          // For GET method, use the apiUrl
          const result = await axios.get(apiUrl);
          setResponse(result.data);
        } else {
          // For POST method, ensure images are properly attached in message content
          
          // Prepare a proper payload with correct structure
          const preparedMessages = messages.map(message => {
            // If it's already properly structured or doesn't have an image, return as is
            if (typeof message.content === 'string' || 
                (Array.isArray(message.content) && !message.content.some(item => item.type === 'image_url'))) {
              return message;
            }
            
            // Ensure the content array follows OpenAI format
            const contentArray = message.content as MessageContent[];
            return {
              role: message.role,
              content: contentArray.map(item => {
                // Make sure image_url objects are properly formatted
                if (item.type === 'image_url') {
                  return {
                    type: 'image_url' as const,  // Use const assertion to help TypeScript
                    image_url: { url: item.image_url.url }
                  };
                }
                return item;
              }) as MessageContent[]  // Explicitly cast back to MessageContent[]
            };
          }) as Message[];  // Ensure final array type is Message[]
          
          const postParams: TextPostParams = {
            messages: preparedMessages,
            model: selectedModel,
            seed,
            jsonMode: json,
            private: privateMode,
            voice: voice || undefined
          };
          
          // Log the prepared request for debugging
          console.log('Sending POST request with payload:', JSON.stringify(postParams, null, 2));
          
          const result = await makeTextPostRequest(postParams);
          setResponse(result);
        }
        
        showNotification('Text response generated successfully!');
      } else {
        // Check if we're using fallback models (which means the API is not available)
        if (modelsError && FALLBACK_IMAGE_MODELS.includes(selectedModel)) {
          setResponseError('Cannot generate image: Unable to connect to Image API. Please try again later.');
          showNotification('Unable to connect to Image API', 'error');
          return;
        }
        
        // For image API, just set the image URL
        setResponse(null);
        setImageResponse(apiUrl);
        showNotification('Image generated successfully!');
      }
    } catch (error) {
      console.error('Error fetching response:', error);
      const errorMessage = getErrorMessage(error);
      setResponseError(errorMessage);
      showNotification(errorMessage, 'error');
    } finally {
      setFetchingResponse(false);
    }
  };
  
  const handleImageError = () => {
    setResponseError('Failed to load the image. The server might be busy or the image may be invalid.');
    showNotification('Failed to load image', 'error');
  };
  
  // Helper function to render response content safely
  const renderResponseContent = () => {
    if (!response) return null;
    
    if (json || typeof response === 'object') {
      return <pre>{safeJsonParse(response)}</pre>;
    }
    
    return <>{response}</>; // Simple string rendering
  };
  
  // Update the preview of the payload in the header tooltip
  const getPayloadPreview = () => {
    return JSON.stringify({
      model: selectedModel,
      messages: messages.map(m => {
        // If content is a string, just return it as is
        if (typeof m.content === 'string') {
          return {
            role: m.role,
            content: m.content
          };
        }
        
        // If content is an array (multimodal), format it properly for display
        return {
          role: m.role,
          content: m.content
        };
      }),
      ...(seed !== undefined && { seed }),
      ...(voice && { voice }),
      ...(json && { jsonMode: true }),
      ...(privateMode && { private: true })
    }, null, 2);
  };
  
  return (
    <Container maxWidth="md">
      {/* Sticky Header with API URL */}
      <Paper 
        elevation={3} 
        sx={{ 
          position: 'sticky',
          top: 0,
          zIndex: 10,
          mb: 3,
          p: 2,
          borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          gap: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 'medium', display: 'flex', alignItems: 'center' }}>
            Pollinations.AI API
            <Tooltip title={useLocalApi ? "Using Local API" : "Using Production API"}>
              <Chip 
                icon={useLocalApi ? <StorageIcon /> : <CloudIcon />} 
                label={useLocalApi ? "Local" : "Production"}
                color={useLocalApi ? "success" : "primary"}
                size="small"
                sx={{ ml: 1.5 }}
                onClick={() => setUseLocalApi(!useLocalApi)}
              />
            </Tooltip>
          </Typography>
          
          {/* API URL display in header - right side */}
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            flexGrow: 1, 
            ml: 2, 
            maxWidth: { xs: '100%', sm: '60%' }
          }}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 1, 
                flexGrow: 1,
                backgroundColor: 'rgba(0, 0, 0, 0.03)',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                border: '1px solid rgba(0, 0, 0, 0.1)'
              }}
            >
              {endpoint === 'text' && textApiMethod === 'POST' ? (
                <Tooltip 
                  title={
                    <Box sx={{ fontFamily: 'monospace', fontSize: '0.7rem', maxWidth: '400px', overflowWrap: 'break-word' }}>
                      {getPayloadPreview()}
                    </Box>
                  } 
                  arrow
                >
                  <span>POST {useLocalApi ? `http://localhost:${ApiConfig.textPort}` : 'https://text.pollinations.ai'} (Hover for payload preview)</span>
                </Tooltip>
              ) : (
                apiUrl || 'Configure endpoint, model, and request parameters to generate a URL'
              )}
            </Paper>
            {apiUrl && (
              <Tooltip title="Copy URL">
                <IconButton 
                  onClick={handleCopyUrl}
                  size="small"
                  aria-label="copy"
                  color="primary"
                  sx={{ ml: 0.5 }}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </Paper>
      
      <Box sx={{ my: 4 }}>
        {modelsError ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {modelsError}
          </Alert>
        ) : null}
        
        {/* Section 1: ENDPOINT */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderTop: '4px solid #3f51b5' }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#3f51b5', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            1. Select Endpoint
          </Typography>
          
          {/* API Type Tabs */}
          <Box sx={{ mt: 2 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="API Configurator tabs"
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
              sx={{ '& .MuiTab-root': { color: 'rgba(63, 81, 181, 0.7)' }, '& .Mui-selected': { color: '#3f51b5' } }}
            >
              <Tab icon={<TextFormatIcon />} label="Text API" {...a11yProps(0)} />
              <Tab icon={<ImageIcon />} label="Image API" {...a11yProps(1)} />
            </Tabs>
          </Box>
        </Paper>
        
        {/* Section 2: MODEL */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderTop: '4px solid #4caf50' }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#4caf50', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            2. Select Model
          </Typography>
          
          {/* Modality Filters - Only for Text API - Moved from Endpoint section */}
          {tabValue === 0 && (
            <Box sx={{ mb: 3, pt: 2, pb: 2, backgroundColor: 'rgba(76, 175, 80, 0.05)', borderRadius: 1, px: 2 }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#4caf50', fontWeight: 'medium' }}>
                Filter by Modality
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="caption" sx={{ mb: 1, color: 'rgba(76, 175, 80, 0.8)' }}>
                    Input
                  </Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <ToggleButtonGroup
                      value={selectedInputModalities}
                      onChange={handleInputModalityChange}
                      aria-label="input modalities"
                      size="small"
                      color="success"
                      sx={{ flexWrap: 'wrap', mb: 1 }}
                      exclusive={false}
                    >
                      {availableInputModalities.map((modality) => (
                        <Tooltip 
                          key={modality}
                          title={universalInputModalities.includes(modality) ? "This modality is always available" : ""}
                        >
                          <span>
                            <ToggleButton 
                              value={modality}
                              sx={{ mr: 0.5, mb: 0.5, textTransform: 'none', borderColor: 'rgba(76, 175, 80, 0.3)' }}
                              disabled={universalInputModalities.includes(modality)}
                            >
                              {modality}
                            </ToggleButton>
                          </span>
                        </Tooltip>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Typography variant="caption" sx={{ mb: 1, textAlign: 'right', width: '100%', color: 'rgba(76, 175, 80, 0.8)' }}>
                    Output
                  </Typography>
                  <Box sx={{ overflowX: 'auto', width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                    <ToggleButtonGroup
                      value={selectedOutputModalities}
                      onChange={handleOutputModalityChange}
                      aria-label="output modalities"
                      size="small"
                      color="success"
                      sx={{ flexWrap: 'wrap', mb: 1 }}
                      exclusive={false}
                    >
                      {availableOutputModalities.map((modality) => (
                        <Tooltip 
                          key={modality}
                          title={universalOutputModalities.includes(modality) ? "This modality is always available" : ""}
                        >
                          <span>
                            <ToggleButton 
                              value={modality}
                              sx={{ mr: 0.5, mb: 0.5, textTransform: 'none', borderColor: 'rgba(76, 175, 80, 0.3)' }}
                              disabled={universalOutputModalities.includes(modality)}
                            >
                              {modality}
                            </ToggleButton>
                          </span>
                        </Tooltip>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
          
          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel id="model-select-label" sx={{ color: 'rgba(76, 175, 80, 0.8)' }}>Model</InputLabel>
            {tabValue === 0 ? (
              <Select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                disabled={loading}
                label="Model"
                displayEmpty
                sx={{ 
                  '& .MuiOutlinedInput-notchedOutline': { 
                    borderColor: 'rgba(76, 175, 80, 0.5)' 
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50'
                  }
                }}
                renderValue={(value) => {
                  if (loading) return <CircularProgress size={20} />;
                  if (!value) return <em>Select a model</em>;
                  const model = textModels.find(m => m.name === value);
                  return `${value} - ${model?.description || ''}`;
                }}
              >
                {loading ? (
                  <MenuItem value="">
                    <CircularProgress size={20} />
                  </MenuItem>
                ) : (
                  filteredTextModels.map((model) => (
                    <MenuItem key={model.name} value={model.name}>
                      {model.name} - {model.description}
                    </MenuItem>
                  ))
                )}
              </Select>
            ) : (
              <Select
                id="model-select"
                value={selectedModel}
                onChange={handleModelChange}
                disabled={loading}
                displayEmpty
                sx={{ 
                  '& .MuiOutlinedInput-notchedOutline': { 
                    borderColor: 'rgba(76, 175, 80, 0.5)' 
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#4caf50'
                  }
                }}
                renderValue={(value) => {
                  if (loading) return <CircularProgress size={20} />;
                  if (!value) return <em>Select a model</em>;
                  return value;
                }}
              >
                {loading ? (
                  <MenuItem value="">
                    <CircularProgress size={20} />
                  </MenuItem>
                ) : (
                  imageModels.map((model) => (
                    <MenuItem key={model} value={model}>
                      {model}
                    </MenuItem>
                  ))
                )}
              </Select>
            )}
          </FormControl>
          
          {/* Model count display - moved from section title to after select dropdown */}
          {tabValue === 0 && (
            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <Chip 
                label={`${filteredTextModels.length} of ${textModels.length} models`}
                size="small"
                color="success"
                variant="outlined"
              />
            </Box>
          )}
          
          {/* Display model properties for text models */}
          {selectedModelDetails && tabValue === 0 && (
            <Box sx={{ mt: 3, pt: 2, borderTop: '1px dashed rgba(76, 175, 80, 0.3)' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ color: '#4caf50' }}>Model Properties</Typography>
              <ModelProperties model={selectedModelDetails} />
            </Box>
          )}
        </Paper>
          
        {/* Section 3: REQUEST */}
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderTop: '4px solid #ff9800' }}>
          <Typography variant="h6" gutterBottom sx={{ color: '#ff9800', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>
            3. Configure Request
            
            {/* Text API method selection - Moved to top of Configure Request section */}
            {tabValue === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', flexGrow: 1 }}>
                <ToggleButtonGroup
                  value={textApiMethod}
                  exclusive
                  onChange={handleApiMethodChange}
                  aria-label="API method"
                  color="warning"
                  size="small"
                >
                  <Tooltip title="Use GET method">
                    <span>
                      <ToggleButton value="GET" aria-label="GET method" sx={{ borderColor: 'rgba(255, 152, 0, 0.5)' }}>
                        <GetAppIcon sx={{ mr: 1 }} />
                        GET
                      </ToggleButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Use POST method">
                    <span>
                      <ToggleButton value="POST" aria-label="POST method" sx={{ borderColor: 'rgba(255, 152, 0, 0.5)' }}>
                        <PostAddIcon sx={{ mr: 1 }} />
                        POST
                      </ToggleButton>
                    </span>
                  </Tooltip>
                </ToggleButtonGroup>
              </Box>
            )}
          </Typography>
          
          {/* Text API - GET method */}
          {tabValue === 0 && textApiMethod === 'GET' && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Prompt */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  multiline
                  rows={2}
                  required
                  placeholder="Enter your prompt here..."
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.7)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}
                />
              </Grid>
              
              {/* Seed */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Seed (optional)"
                  type="number"
                  value={seed === undefined ? '' : seed}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                  helperText="For reproducible results"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}
                />
              </Grid>
              
              {/* System prompt */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="System Prompt (optional)"
                  value={system}
                  onChange={(e) => setSystem(e.target.value)}
                  helperText="Instructions for the model"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}
                />
              </Grid>
              
              {/* Audio voice selection */}
              {selectedModelDetails?.audio && selectedModelDetails?.voices && selectedModelDetails.voices.length > 0 && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}>
                    <InputLabel id="voice-select-label">Voice</InputLabel>
                    <Select
                      labelId="voice-select-label"
                      id="voice-select"
                      value={voice}
                      label="Voice"
                      onChange={(e) => setVoice(e.target.value)}
                    >
                      {selectedModelDetails.voices.map((voiceOption) => (
                        <MenuItem key={voiceOption} value={voiceOption}>
                          {voiceOption}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              
              {/* Additional options */}
              <Grid item xs={12}>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 2, 
                  p: 2, 
                  background: 'rgba(255, 152, 0, 0.05)', 
                  borderRadius: 1 
                }}>
                  <FormControlLabel
                    control={<Switch checked={json} onChange={(e) => setJson(e.target.checked)} color="warning" />}
                    label="JSON Response"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                  <FormControlLabel
                    control={<Switch checked={privateMode} onChange={(e) => setPrivateMode(e.target.checked)} color="warning" />}
                    label="Private"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                </Box>
              </Grid>
            </Grid>
          )}
          
          {/* Text API - POST method */}
          {tabValue === 0 && textApiMethod === 'POST' && (
            <Box sx={{ mt: 2 }}>
              {/* Messages */}
              <Box sx={{ mb: 3 }}>
                {messages.map((message, index) => (
                  <Card 
                    key={index} 
                    sx={{ 
                      mb: 2,
                      borderLeft: `4px solid rgba(255, 152, 0, 0.7)`
                    }}
                  >
                    <CardContent>
                      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="subtitle2" sx={{ color: '#ff9800' }}>
                          {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
                        </Typography>
                        {index > 0 && (
                          <IconButton 
                            size="small" 
                            onClick={() => removeMessage(index)}
                            sx={{ color: 'rgba(255, 152, 0, 0.7)' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                      
                      {/* Image input for user messages */}
                      {message.role === 'user' && selectedModelDetails?.vision && (
                        <Box sx={{ mb: 2 }}>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder="Image URL (optional)"
                            label="Image URL"
                            value={imageUrls[index] || ''}
                            onChange={(e) => {
                              const url = e.target.value;
                              handleImageUrlChange(index, url);
                              if (url) {
                                confirmAddImage(index);
                              } else {
                                // If URL is cleared, remove the image
                                if (messageHasImage(index)) {
                                  const newMessages = [...messages];
                                  const textContent = typeof newMessages[index].content === 'string' 
                                    ? newMessages[index].content 
                                    : (newMessages[index].content as MessageContent[])
                                        .find(c => c.type === 'text')
                                        ? ((newMessages[index].content as MessageContent[])
                                            .find(c => c.type === 'text') as { type: 'text', text: string }).text
                                        : '';
                                  
                                  newMessages[index] = { 
                                    ...newMessages[index], 
                                    content: textContent 
                                  };
                                  setMessages(newMessages);
                                }
                              }
                            }}
                            sx={{ 
                              mb: 1,
                              '& .MuiOutlinedInput-root': {
                                '& fieldset': {
                                  borderColor: 'rgba(255, 152, 0, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                  borderColor: '#ff9800',
                                },
                              },
                              '& .MuiInputLabel-root': {
                                color: 'rgba(255, 152, 0, 0.8)',
                              },
                              '& .MuiInputLabel-root.Mui-focused': {
                                color: '#ff9800',
                              },
                            }}
                          />
                          
                          {/* Image preview box */}
                          <Box 
                            sx={{ 
                              width: '100%',
                              textAlign: 'center',
                              p: 1,
                              border: '1px dashed rgba(255, 152, 0, 0.5)',
                              borderRadius: 1,
                              minHeight: '100px',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'center',
                              backgroundColor: 'rgba(255, 152, 0, 0.02)'
                            }}
                          >
                            {imageUrls[index] ? (
                              <img 
                                src={transformGoogleDriveUrl(imageUrls[index])} 
                                alt="Attached" 
                                style={{ maxWidth: '100%', maxHeight: '200px' }} 
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).setAttribute('data-error', 'true');
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                  const parent = e.currentTarget.parentElement;
                                  let errorMsg = parent?.querySelector('.error-message') as HTMLParagraphElement | null;
                                  if (!errorMsg) {
                                    errorMsg = document.createElement('p');
                                    errorMsg.className = 'error-message';
                                    errorMsg.style.color = '#f44336';
                                    errorMsg.style.margin = '10px 0';
                                    if (parent) parent.appendChild(errorMsg);
                                  }
                                  if (errorMsg) errorMsg.textContent = 'Invalid image URL';
                                }}
                                onLoad={(e) => {
                                  (e.currentTarget as HTMLImageElement).removeAttribute('data-error');
                                  (e.currentTarget as HTMLImageElement).style.display = 'block';
                                  const parent = e.currentTarget.parentElement;
                                  const errorMsg = parent?.querySelector('.error-message');
                                  if (errorMsg) errorMsg.remove();
                                }}
                              />
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                No image attached
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      )}
                      
                      <TextField
                        fullWidth
                        multiline
                        rows={2}
                        placeholder={`Enter ${message.role} message...`}
                        value={
                          typeof message.content === 'string' 
                            ? message.content
                            : Array.isArray(message.content)
                              ? (message.content.find(c => c.type === 'text') as { type: 'text', text: string })?.text || ''
                              : ''
                        }
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                          updateMessage(index, e.target.value, !!(typeof message.content !== 'string'))
                        }
                        sx={{ 
                          '& .MuiOutlinedInput-root': {
                            '& fieldset': {
                              borderColor: 'rgba(255, 152, 0, 0.5)',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#ff9800',
                            },
                          }
                        }}
                      />
                    </CardContent>
                  </Card>
                ))}
                
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <ButtonGroup variant="outlined" color="warning">
                    <Button 
                      startIcon={<AddIcon />}
                      onClick={() => addMessage('system')}
                      sx={{ borderColor: 'rgba(255, 152, 0, 0.5)', color: '#ff9800' }}
                    >
                      System
                    </Button>
                    <Button 
                      startIcon={<AddIcon />}
                      onClick={() => addMessage('user')}
                      sx={{ borderColor: 'rgba(255, 152, 0, 0.5)', color: '#ff9800' }}
                    >
                      User
                    </Button>
                    <Button 
                      startIcon={<AddIcon />}
                      onClick={() => addMessage('assistant')}
                      sx={{ borderColor: 'rgba(255, 152, 0, 0.5)', color: '#ff9800' }}
                    >
                      Assistant
                    </Button>
                  </ButtonGroup>
                </Box>
              </Box>
              
              {/* POST parameters */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Seed (optional)"
                    type="number"
                    value={seed === undefined ? '' : seed}
                    onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                    sx={{ 
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(255, 152, 0, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#ff9800',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255, 152, 0, 0.8)',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#ff9800',
                      },
                    }}
                  />
                </Grid>
                
                {/* Voice selection */}
                {selectedModelDetails?.audio && selectedModelDetails?.voices && selectedModelDetails.voices.length > 0 && (
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth sx={{
                      '& .MuiOutlinedInput-root': {
                        '& fieldset': {
                          borderColor: 'rgba(255, 152, 0, 0.5)',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#ff9800',
                        },
                      },
                      '& .MuiInputLabel-root': {
                        color: 'rgba(255, 152, 0, 0.8)',
                      },
                      '& .MuiInputLabel-root.Mui-focused': {
                        color: '#ff9800',
                      },
                    }}>
                      <InputLabel id="voice-select-label">Voice</InputLabel>
                      <Select
                        labelId="voice-select-label"
                        id="voice-select"
                        value={voice}
                        label="Voice"
                        onChange={(e) => setVoice(e.target.value)}
                      >
                        {selectedModelDetails.voices.map((voiceOption) => (
                          <MenuItem key={voiceOption} value={voiceOption}>
                            {voiceOption}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                
                {/* Additional options */}
                <Grid item xs={12}>
                  <Box sx={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: 2, 
                    p: 2, 
                    background: 'rgba(255, 152, 0, 0.05)', 
                    borderRadius: 1 
                  }}>
                    <FormControlLabel
                      control={<Switch checked={json} onChange={(e) => setJson(e.target.checked)} color="warning" />}
                      label="JSON Mode"
                      sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                    />
                    <FormControlLabel
                      control={<Switch checked={privateMode} onChange={(e) => setPrivateMode(e.target.checked)} color="warning" />}
                      label="Private"
                      sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                    />
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
          
          {/* Image API */}
          {tabValue === 1 && (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              {/* Prompt */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  multiline
                  rows={2}
                  required
                  placeholder="Describe the image you want to generate..."
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&:hover fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.7)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}
                />
              </Grid>
              
              {/* Seed */}
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Seed (optional)"
                  type="number"
                  value={seed === undefined ? '' : seed}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                  helperText="For reproducible results"
                  sx={{ 
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': {
                        borderColor: 'rgba(255, 152, 0, 0.5)',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#ff9800',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: 'rgba(255, 152, 0, 0.8)',
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: '#ff9800',
                    },
                  }}
                />
              </Grid>
              
              {/* Dimensions */}
              <Grid item xs={12} sm={6}>
                <Typography gutterBottom sx={{ color: 'rgba(255, 152, 0, 0.8)' }}>Dimensions</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" gutterBottom sx={{ color: 'rgba(255, 152, 0, 0.8)' }}>Width: {width}</Typography>
                    <Slider
                      value={width}
                      onChange={(e, newValue) => setWidth(newValue as number)}
                      min={256}
                      max={2048}
                      step={64}
                      marks={[
                        { value: 256, label: '256' },
                        { value: 1024, label: '1024' },
                        { value: 2048, label: '2048' },
                      ]}
                      color="warning"
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" gutterBottom sx={{ color: 'rgba(255, 152, 0, 0.8)' }}>Height: {height}</Typography>
                    <Slider
                      value={height}
                      onChange={(e, newValue) => setHeight(newValue as number)}
                      min={256}
                      max={2048}
                      step={64}
                      marks={[
                        { value: 256, label: '256' },
                        { value: 1024, label: '1024' },
                        { value: 2048, label: '2048' },
                      ]}
                      color="warning"
                    />
                  </Box>
                </Box>
              </Grid>
              
              {/* Additional options */}
              <Grid item xs={12}>
                <Box sx={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: 2, 
                  p: 2, 
                  background: 'rgba(255, 152, 0, 0.05)', 
                  borderRadius: 1 
                }}>
                  <FormControlLabel
                    control={<Switch checked={nologo} onChange={(e) => setNologo(e.target.checked)} color="warning" />}
                    label="No Logo"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                  <FormControlLabel
                    control={<Switch checked={privateMode} onChange={(e) => setPrivateMode(e.target.checked)} color="warning" />}
                    label="Private"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                  <FormControlLabel
                    control={<Switch checked={enhance} onChange={(e) => setEnhance(e.target.checked)} color="warning" />}
                    label="Enhance"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                  <FormControlLabel
                    control={<Switch checked={safe} onChange={(e) => setSafe(e.target.checked)} color="warning" />}
                    label="Safe"
                    sx={{ color: 'rgba(255, 152, 0, 0.8)' }}
                  />
                </Box>
              </Grid>
            </Grid>
          )}
          
          {/* Submit Button */}
          <Button 
            variant="contained" 
            color="warning"
            fullWidth
            sx={{ mt: 3 }}
            disabled={!apiUrl || fetchingResponse}
            onClick={fetchResponse}
          >
            {fetchingResponse ? (
              <>
                <CircularProgress size={24} color="inherit" sx={{ mr: 1 }} />
                Loading...
              </>
            ) : (
              'Generate Response'
            )}
          </Button>
        </Paper>
        
        {/* Section 4: RESPONSE */}
        {(response || imageResponse || responseError) && (
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderTop: '4px solid #f44336' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#f44336', fontWeight: 'bold' }}>
              4. Response
            </Typography>
            
            {responseError ? (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 2, 
                  backgroundColor: 'rgba(244, 67, 54, 0.05)',
                  color: '#f44336',
                  mt: 2
                }}
              >
                {responseError}
              </Paper>
            ) : imageResponse ? (
              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2,
                    backgroundColor: 'rgba(244, 67, 54, 0.03)',
                    overflow: 'hidden',
                    border: '1px solid rgba(244, 67, 54, 0.2)'
                  }}
                >
                  <img 
                    src={transformGoogleDriveUrl(imageResponse)} 
                    alt="Generated"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '500px',
                      objectFit: 'contain' 
                    }}
                    onError={handleImageError}
                  />
                </Paper>
                <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                  Generated Image: "{prompt}"
                </Typography>
              </Box>
            ) : response ? (
              <Paper 
                elevation={1} 
                sx={{ 
                  p: 2, 
                  mt: 2,
                  backgroundColor: 'rgba(244, 67, 54, 0.03)',
                  fontFamily: json || typeof response === 'object' ? 'monospace' : 'inherit',
                  whiteSpace: 'pre-wrap',
                  overflow: 'auto',
                  maxHeight: '500px',
                  border: '1px solid rgba(244, 67, 54, 0.2)'
                }}
              >
                {renderResponseContent()}
              </Paper>
            ) : null}
          </Paper>
        )}
      </Box>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ApiConfigurator; 