# Uptime Monitoring Backend

This module provides backend-based uptime monitoring for Pollinations AI models.

## Overview

The uptime monitor tracks the availability of text and image models, storing historical data on the server instead of in the browser's localStorage. This ensures that uptime history persists across users and sessions.

## Features

- **Server-side Storage**: Uptime data stored in `uptime_data.json`
- **Persistent History**: Keeps up to 24 hours of data (288 entries at 5-minute intervals)
- **Automatic Cleanup**: Removes data older than 24 hours
- **File Persistence**: Automatically saves data every 5 minutes
- **RESTful API**: Simple GET/POST endpoints for reading and recording uptime

## API Endpoints

### GET /uptime

Returns uptime data for all tracked models.

**Response:**
```json
{
  "openai": {
    "history": [
      { "timestamp": 1234567890, "status": "up" },
      { "timestamp": 1234567950, "status": "up" }
    ],
    "lastCheck": 1234567950,
    "currentStatus": "online",
    "type": "text"
  },
  "flux": {
    "history": [...],
    "lastCheck": 1234567950,
    "currentStatus": "online",
    "type": "image"
  }
}
```

### GET /uptime/:modelName

Returns uptime data for a specific model, including calculated uptime percentage.

**Response:**
```json
{
  "model": "openai",
  "history": [
    { "timestamp": 1234567890, "status": "up" }
  ],
  "lastCheck": 1234567950,
  "currentStatus": "online",
  "type": "text",
  "uptimePercentage": 100
}
```

**Error Response (404):**
```json
{
  "error": "Model not found"
}
```

### POST /uptime/:modelName

Records an uptime check for a model.

**Request Body:**
```json
{
  "isUp": true,
  "type": "text"
}
```

**Parameters:**
- `isUp` (boolean, required): Whether the model is currently up
- `type` (string, optional): Model type ("text" or "image"), defaults to "text"

**Response:**
```json
{
  "success": true,
  "model": "openai",
  "status": "up"
}
```

**Error Response (400):**
```json
{
  "error": "isUp must be a boolean"
}
```

## Usage Example

```javascript
// Frontend code to check and record uptime
async function checkModelUptime(modelName, type = 'text') {
    let isUp = false;
    
    try {
        // Check if model is up (example for text models)
        const response = await fetch('https://text.pollinations.ai/models');
        const models = await response.json();
        isUp = models.some(m => m.name === modelName);
    } catch (error) {
        isUp = false;
    }
    
    // Record the check result
    await fetch(`https://text.pollinations.ai/uptime/${modelName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isUp, type })
    });
    
    // Get updated uptime data
    const uptimeResponse = await fetch(`https://text.pollinations.ai/uptime/${modelName}`);
    const uptimeData = await uptimeResponse.json();
    
    console.log(`${modelName}: ${uptimeData.currentStatus} (${uptimeData.uptimePercentage}% uptime)`);
}
```

## Data Structure

### In-Memory Storage

```javascript
{
  "modelName": {
    history: [
      { timestamp: number, status: "up" | "down" }
    ],
    lastCheck: number,
    currentStatus: "online" | "offline" | "unknown",
    type: "text" | "image"
  }
}
```

### History Management

- **Maximum entries**: 288 (24 hours at 5-minute intervals)
- **Cleanup**: Automatically removes entries older than 24 hours
- **Persistence**: Saves to `uptime_data.json` every 5 minutes

## Implementation Details

The uptime monitor is implemented in `uptimeMonitor.js` and provides:

- `recordCheck(modelName, isUp, type)`: Record an uptime check
- `getModelUptime(modelName)`: Get uptime data for a model
- `getAllUptime()`: Get all uptime data
- `getUptimePercentage(modelName, hours)`: Calculate uptime percentage
- `cleanupOldData()`: Remove old entries

## Integration with Model Viewer

The model viewer frontend (`hacktoberfest-2025/model-viewer/script.js`) uses this backend:

1. Loads initial uptime data on page load
2. Checks each model's availability every 5 minutes
3. Records results to the backend via POST requests
4. Displays uptime history and percentage in the UI

## Benefits Over Client-Side Storage

- **Persistent across users**: All users see the same uptime history
- **No localStorage limits**: Can store more data without browser constraints
- **Centralized monitoring**: Single source of truth for all model uptime
- **Better for analytics**: Can analyze uptime patterns server-side
