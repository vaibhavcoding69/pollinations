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
  TextPostParams
} from '../services/api';

// Define endpoint options (keeping for backward compatibility)
const endpoints = [
  { value: 'text', label: 'Text API' },
  { value: 'image', label: 'Image API' }
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

// Check if we're using local API endpoints
const isUsingLocalApi = process.env.REACT_APP_USE_LOCAL_API === 'true';

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
  
  // Fetch models based on selected endpoint
  useEffect(() => {
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
          const models = await fetchImageModels();
          setImageModels(models);
          if (models.length > 0) {
            setSelectedModel(models[0]);
            setSelectedModelDetails(null); // Clear model details for image models
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
    
    fetchModels();
    
    // Clear responses when changing endpoints
    setResponse(null);
    setImageResponse(null);
    setResponseError(null);
  }, [endpoint]);
  
  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    // Update endpoint based on tab
    setEndpoint(newValue === 0 ? 'text' : 'image');
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
        setApiUrl(`${isUsingLocalApi ? '/text-api' : 'https://text.pollinations.ai'} (POST request with ${messages.length} messages)`);
      }
    }
  }, [
    endpoint, prompt, selectedModel, seed, width, height, 
    nologo, privateMode, enhance, safe, json, system, voice,
    textApiMethod, messages
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
        if (isUsingLocalApi) {
          return `No response received from local ${endpoint} API server. Is the server running on the expected port? Check .env configuration.`;
        }
        return 'No response received from server. Please check your internet connection.';
      }
    }
    
    // For local API connections, show more specific error messages
    if (isUsingLocalApi && error.message && error.message.includes('Network Error')) {
      return `Failed to connect to local ${endpoint} API server. Ensure it's running on the correct port as specified in .env file.`;
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
  
  // Add an image to a message
  const addImageToMessage = (index: number, imageUrl: string) => {
    const newMessages = [...messages];
    let contentArray: MessageContent[];
    
    // If the content is a string, convert it to an array with the existing text
    if (typeof newMessages[index].content === 'string') {
      const textContent = newMessages[index].content as string;
      contentArray = [
        { type: 'text', text: textContent },
        { type: 'image_url', image_url: { url: imageUrl } }
      ];
    } else {
      // Content is already an array, add the image to it
      contentArray = [...(newMessages[index].content as MessageContent[])];
      
      // Check if image is already present; if so, update it
      const imageIndex = contentArray.findIndex(item => item.type === 'image_url');
      if (imageIndex >= 0) {
        contentArray[imageIndex] = { type: 'image_url', image_url: { url: imageUrl } };
      } else {
        contentArray.push({ type: 'image_url', image_url: { url: imageUrl } });
      }
    }
    
    newMessages[index] = { ...newMessages[index], content: contentArray };
    setMessages(newMessages);
    
    // Store the image URL for the UI
    setImageUrls({ ...imageUrls, [index]: imageUrl });
  };
  
  // Handle updating an image URL
  const handleImageUrlChange = (index: number, url: string) => {
    setImageUrls({ ...imageUrls, [index]: url });
  };
  
  // Confirm adding an image to a message
  const confirmAddImage = (index: number) => {
    if (imageUrls[index]) {
      addImageToMessage(index, imageUrls[index]);
    }
  };
  
  // Check if a message has an image
  const messageHasImage = (index: number): boolean => {
    const message = messages[index];
    if (typeof message.content === 'string') return false;
    
    const contentArray = message.content as MessageContent[];
    return contentArray.some(item => 'image_url' in item);
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
          // For POST method, use the structured messages
          const postParams: TextPostParams = {
            messages,
            model: selectedModel,
            seed,
            jsonMode: json,
            private: privateMode,
            voice: voice || undefined
          };
          
          const result = await makeTextPostRequest(postParams);
          setResponse(result);
        }
        
        showNotification('Text response generated successfully!');
      } else {
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
  
  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center" sx={{ flexGrow: 1 }}>
            Pollinations.AI API URL Configurator
          </Typography>
          <Tooltip title={isUsingLocalApi ? "Using Local API" : "Using Production API"}>
            <Chip 
              icon={isUsingLocalApi ? <StorageIcon /> : <CloudIcon />} 
              label={isUsingLocalApi ? "Local" : "Production"}
              color={isUsingLocalApi ? "success" : "primary"}
              size="small"
            />
          </Tooltip>
        </Box>
        
        <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
          {modelsError ? (
            <Alert severity="error" sx={{ mb: 3 }}>
              {modelsError}
            </Alert>
          ) : null}
          
          {/* API Type Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              aria-label="API Configurator tabs"
              centered
            >
              <Tab icon={<TextFormatIcon />}  {...a11yProps(0)} />
              <Tab icon={<ImageIcon />}  {...a11yProps(1)} />
            </Tabs>
          </Box>
          
          {/* Text API Content */}
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              {/* API Method Selection */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
                  <ToggleButtonGroup
                    value={textApiMethod}
                    exclusive
                    onChange={handleApiMethodChange}
                    aria-label="API method"
                  >
                    <ToggleButton value="GET" aria-label="GET method">
                      <GetAppIcon sx={{ mr: 1 }} />
                      GET
                    </ToggleButton>
                    <ToggleButton value="POST" aria-label="POST method">
                      <PostAddIcon sx={{ mr: 1 }} />
                      POST
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Box>
              </Grid>
              
              {/* Modality Filters - Side by side in one row with right alignment for output */}
              <Grid container item xs={12} sx={{ mb: 2 }}>
                <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Input Modalities
                  </Typography>
                  <Box sx={{ overflowX: 'auto' }}>
                    <ToggleButtonGroup
                      value={selectedInputModalities}
                      onChange={handleInputModalityChange}
                      aria-label="input modalities"
                      size="small"
                      color="primary"
                      sx={{ flexWrap: 'wrap', mb: 1 }}
                      exclusive={false}
                    >
                      {availableInputModalities.map((modality) => (
                        <ToggleButton 
                          key={modality} 
                          value={modality}
                          sx={{ mr: 0.5, mb: 0.5, textTransform: 'none' }}
                          disabled={universalInputModalities.includes(modality)}
                        >
                          {modality}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </Grid>
                
                <Grid item xs={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, textAlign: 'right', width: '100%' }}>
                    Output Modalities
                  </Typography>
                  <Box sx={{ overflowX: 'auto', width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
                    <ToggleButtonGroup
                      value={selectedOutputModalities}
                      onChange={handleOutputModalityChange}
                      aria-label="output modalities"
                      size="small"
                      color="primary"
                      sx={{ flexWrap: 'wrap', mb: 1 }}
                      exclusive={false}
                    >
                      {availableOutputModalities.map((modality) => (
                        <ToggleButton 
                          key={modality} 
                          value={modality}
                          sx={{ mr: 0.5, mb: 0.5, textTransform: 'none' }}
                          disabled={universalOutputModalities.includes(modality)}
                        >
                          {modality}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                  </Box>
                </Grid>
              </Grid>
              
              {/* Model Selection */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                    Model Selection
                  </Typography>
                  <Chip 
                    label={`${filteredTextModels.length} of ${textModels.length} models`}
                    size="small"
                    color={filteredTextModels.length < textModels.length ? "primary" : "default"}
                    variant="outlined"
                  />
                </Box>
                <FormControl fullWidth>
                  <Select
                    labelId="model-select-label"
                    id="model-select"
                    value={selectedModel}
                    onChange={handleModelChange}
                    disabled={loading}
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
                </FormControl>
                
                {/* Display model properties for text models */}
                {selectedModelDetails && (
                  <ModelProperties model={selectedModelDetails} />
                )}
              </Grid>
              
              {/* GET Method UI */}
              {textApiMethod === 'GET' && (
                <>
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
                    />
                  </Grid>
                  
                  {/* Seed */}
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Seed (optional)"
                      type="number"
                      value={seed === undefined ? '' : seed}
                      onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </Grid>
                  
                  {/* Text-specific parameters */}
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={json}
                          onChange={(e) => setJson(e.target.checked)}
                        />
                      }
                      label="JSON Response"
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privateMode}
                          onChange={(e) => setPrivateMode(e.target.checked)}
                        />
                      }
                      label="Private"
                    />
                  </Grid>
                  
                  {/* Audio voice selection - only visible for models with audio capability */}
                  {selectedModelDetails?.audio && selectedModelDetails?.voices && selectedModelDetails.voices.length > 0 && (
                    <Grid item xs={12}>
                      <FormControl fullWidth>
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
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="System Prompt (optional)"
                      value={system}
                      onChange={(e) => setSystem(e.target.value)}
                      multiline
                      rows={2}
                    />
                  </Grid>
                </>
              )}
              
              {/* POST Method UI */}
              {textApiMethod === 'POST' && (
                <Grid item xs={12}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Messages
                    </Typography>
                    
                    {messages.map((message, index) => (
                      <Card 
                        key={index} 
                        sx={{ 
                          mb: 2,
                          borderLeft: `4px solid ${
                            message.role === 'system' 
                              ? 'purple' 
                              : message.role === 'user' 
                                ? 'blue'
                                : 'green'
                          }`
                        }}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                              {message.role.charAt(0).toUpperCase() + message.role.slice(1)}
                            </Typography>
                            <ButtonGroup size="small">
                              {/* Show image button for user messages if model supports vision */}
                              {message.role === 'user' && selectedModelDetails?.vision && (
                                <Tooltip title="Add Image">
                                  <Button
                                    variant="outlined"
                                    onClick={() => {
                                      const defaultUrl = imageUrls[index] || '';
                                      const url = window.prompt('Enter image URL:', defaultUrl);
                                      if (url) {
                                        handleImageUrlChange(index, url);
                                        confirmAddImage(index);
                                      }
                                    }}
                                  >
                                    <PhotoIcon fontSize="small" />
                                  </Button>
                                </Tooltip>
                              )}
                              <Tooltip title="Remove Message">
                                <Button
                                  color="error"
                                  variant="outlined"
                                  onClick={() => removeMessage(index)}
                                  disabled={messages.length <= 1}
                                >
                                  <DeleteIcon fontSize="small" />
                                </Button>
                              </Tooltip>
                            </ButtonGroup>
                          </Box>
                          
                          {/* Render image preview if there is one */}
                          {messageHasImage(index) && (
                            <Box 
                              sx={{ 
                                width: '100%', 
                                textAlign: 'center', 
                                mb: 2, 
                                p: 1,
                                border: '1px dashed grey',
                                borderRadius: 1
                              }}
                            >
                              <Typography variant="caption" display="block" gutterBottom>
                                Image Attached
                              </Typography>
                              {imageUrls[index] && (
                                <img 
                                  src={imageUrls[index]} 
                                  alt="Attached" 
                                  style={{ maxWidth: '100%', maxHeight: '200px' }} 
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://via.placeholder.com/400x200?text=Image+Load+Error';
                                  }}
                                />
                              )}
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
                          />
                        </CardContent>
                      </Card>
                    ))}
                    
                    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                      <ButtonGroup variant="outlined">
                        <Button 
                          startIcon={<AddIcon />}
                          onClick={() => addMessage('system')}
                        >
                          System
                        </Button>
                        <Button 
                          startIcon={<AddIcon />}
                          onClick={() => addMessage('user')}
                        >
                          User
                        </Button>
                        <Button 
                          startIcon={<AddIcon />}
                          onClick={() => addMessage('assistant')}
                        >
                          Assistant
                        </Button>
                      </ButtonGroup>
                    </Box>
                  </Box>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={json}
                            onChange={(e) => setJson(e.target.checked)}
                          />
                        }
                        label="JSON Mode"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={privateMode}
                            onChange={(e) => setPrivateMode(e.target.checked)}
                          />
                        }
                        label="Private"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Seed (optional)"
                        type="number"
                        value={seed === undefined ? '' : seed}
                        onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                      />
                    </Grid>
                    
                    {/* Audio voice selection - only visible for models with audio capability */}
                    {selectedModelDetails?.audio && selectedModelDetails?.voices && selectedModelDetails.voices.length > 0 && (
                      <Grid item xs={12}>
                        <FormControl fullWidth>
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
                  </Grid>
                </Grid>
              )}
            </Grid>
          </TabPanel>
          
          {/* Image API Content */}
          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              {/* Model Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel id="model-select-label">Model</InputLabel>
                  <Select
                    labelId="model-select-label"
                    id="model-select"
                    value={selectedModel}
                    label="Model"
                    onChange={handleModelChange}
                    disabled={loading}
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
                </FormControl>
              </Grid>
              
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
                />
              </Grid>
              
              {/* Seed */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Seed (optional)"
                  type="number"
                  value={seed === undefined ? '' : seed}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                />
              </Grid>
              
              {/* Image-specific parameters */}
              <Grid item xs={12} sm={6}>
                <Typography id="width-slider" gutterBottom>
                  Width: {width}
                </Typography>
                <Slider
                  value={width}
                  onChange={(e, newValue) => setWidth(newValue as number)}
                  aria-labelledby="width-slider"
                  min={256}
                  max={2048}
                  step={64}
                  marks={[
                    { value: 256, label: '256' },
                    { value: 1024, label: '1024' },
                    { value: 2048, label: '2048' },
                  ]}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography id="height-slider" gutterBottom>
                  Height: {height}
                </Typography>
                <Slider
                  value={height}
                  onChange={(e, newValue) => setHeight(newValue as number)}
                  aria-labelledby="height-slider"
                  min={256}
                  max={2048}
                  step={64}
                  marks={[
                    { value: 256, label: '256' },
                    { value: 1024, label: '1024' },
                    { value: 2048, label: '2048' },
                  ]}
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={nologo}
                      onChange={(e) => setNologo(e.target.checked)}
                    />
                  }
                  label="No Logo"
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={privateMode}
                      onChange={(e) => setPrivateMode(e.target.checked)}
                    />
                  }
                  label="Private"
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enhance}
                      onChange={(e) => setEnhance(e.target.checked)}
                    />
                  }
                  label="Enhance"
                />
              </Grid>
              
              <Grid item xs={12} sm={3}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={safe}
                      onChange={(e) => setSafe(e.target.checked)}
                    />
                  }
                  label="Safe"
                />
              </Grid>
            </Grid>
          </TabPanel>
          
          {/* Generated API URL - Common for both tabs */}
          <Box sx={{ mt: 4 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                    Generated API URL:
                  </Typography>
                  {apiUrl && (
                    <Tooltip title="Copy URL">
                      <IconButton 
                        onClick={handleCopyUrl}
                        size="small"
                        aria-label="copy"
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Paper 
                  elevation={1} 
                  sx={{ 
                    p: 2, 
                    mt: 1, 
                    overflowX: 'auto',
                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                    fontFamily: 'monospace'
                  }}
                >
                  {apiUrl || 'Enter a prompt to generate a URL'}
                </Paper>
              </Grid>
              
              {/* Generate Response Button */}
              <Grid item xs={12}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  fullWidth
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
              </Grid>
              
              {/* Response Container */}
              {(response || imageResponse || responseError) && (
                <>
                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="h6" gutterBottom>
                      Response Preview
                    </Typography>
                  </Grid>
                  
                  <Grid item xs={12}>
                    {responseError ? (
                      <Paper 
                        elevation={1} 
                        sx={{ 
                          p: 2, 
                          backgroundColor: 'rgba(255, 0, 0, 0.05)',
                          color: 'error.main'
                        }}
                      >
                        {responseError}
                      </Paper>
                    ) : imageResponse ? (
                      <Box sx={{ textAlign: 'center' }}>
                        <Paper 
                          elevation={1} 
                          sx={{ 
                            p: 2,
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            overflow: 'hidden'
                          }}
                        >
                          <img 
                            src={imageResponse} 
                            alt="Generated"
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '500px',
                              objectFit: 'contain' 
                            }}
                            onError={handleImageError}
                          />
                        </Paper>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                          Generated Image: "{prompt}"
                        </Typography>
                      </Box>
                    ) : response ? (
                      <Paper 
                        elevation={1} 
                        sx={{ 
                          p: 2, 
                          backgroundColor: 'rgba(0, 0, 0, 0.04)',
                          fontFamily: json || typeof response === 'object' ? 'monospace' : 'inherit',
                          whiteSpace: 'pre-wrap',
                          overflow: 'auto',
                          maxHeight: '500px'
                        }}
                      >
                        {renderResponseContent()}
                      </Paper>
                    ) : null}
                  </Grid>
                </>
              )}
            </Grid>
          </Box>
        </Paper>
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