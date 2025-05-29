import fs from 'fs';
import path from 'path';
import debug from 'debug';

const logError = debug('pollinations:error');

// Path for temporary logs
const LOG_DIR = path.join(process.cwd(), 'temp_logs');
const LOG_FILE = path.join(LOG_DIR, 'gptimage_requests.jsonl');

/**
 * Ensures the log directory exists
 */
const ensureLogDirExists = () => {
  if (!fs.existsSync(LOG_DIR)) {
    try {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    } catch (error) {
      logError('Failed to create log directory:', error);
    }
  }
};

/**
 * Logs a gptimage request to a temporary file
 * @param {Object} data - Data to log
 * @param {Object} [userInfo={}] - User information including tier
 */
export const logGptImageRequest = (data, userInfo = {}) => {
  try {
    ensureLogDirExists();
    
    // Add timestamp and user tier to the data
    const logEntry = {
      ...data,
      timestamp: new Date().toISOString(),
      userTier: userInfo.tier || 'unknown',
      userId: userInfo.userId || 'anonymous'
    };
    
    // Append to log file as JSON line
    fs.appendFileSync(
      LOG_FILE, 
      JSON.stringify(logEntry) + '\n', 
      { encoding: 'utf8' }
    );
  } catch (error) {
    logError('Error logging gptimage request:', error);
  }
};

/**
 * Logs a successful gptimage response
 * @param {string} requestId - The request ID to match with the request
 * @param {Object} responseData - Data about the response
 */
export const logGptImageResponse = (requestId, responseData) => {
  try {
    ensureLogDirExists();
    
    const logEntry = {
      requestId,
      ...responseData,
      timestamp: new Date().toISOString(),
      type: 'response'
    };
    
    fs.appendFileSync(
      LOG_FILE, 
      JSON.stringify(logEntry) + '\n', 
      { encoding: 'utf8' }
    );
  } catch (error) {
    logError('Error logging gptimage response:', error);
  }
};

/**
 * Logs an error in a gptimage request
 * @param {string} requestId - The request ID to match with the request
 * @param {Error} error - The error that occurred
 */
export const logGptImageError = (requestId, error) => {
  try {
    ensureLogDirExists();
    
    const logEntry = {
      requestId,
      error: {
        message: error.message,
        stack: error.stack,
      },
      timestamp: new Date().toISOString(),
      type: 'error'
    };
    
    fs.appendFileSync(
      LOG_FILE, 
      JSON.stringify(logEntry) + '\n', 
      { encoding: 'utf8' }
    );
  } catch (logError) {
    logError('Error logging gptimage error:', logError);
  }
};
