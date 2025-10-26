# 🤖 Model Viewer - AI Models Explorer

A feature-rich viewer for exploring Pollinations AI models with real-time uptime monitoring and AI-powered insights.

## Features

- **17 AI Models** - 13 text + 4 image generation models
- **Real-time Uptime Monitoring** - 24-hour history with visual bars and percentage tracking (backend-based)
- **Pre-generated AI Insights** - Curated descriptions for every model
- **Advanced Search & Filters** - Search, filter by tier/capabilities
- **Multiple View Modes** - Grid, List, and Compact views
- **Code Examples** - Instant JavaScript, Python, and cURL snippets
- **Dark Mode** - Persistent theme with localStorage
- **Favorites System** - Mark and save favorite models

## Quick Start

1. Open `index.html` in any modern browser
2. Browse models using the Text/Image tabs
3. Search, filter, and sort as needed
4. Click 💻 Code for implementation examples
5. Monitor uptime with visual history bars

## Tech Stack

- **Pure HTML/CSS/JS** - No dependencies, no build step
- **Pollinations APIs** - Text and image model endpoints
- **Backend Storage** - Uptime data stored on text.pollinations.ai backend
- **Modern JavaScript** - Async/await, ES6+, Fetch API

## Uptime Monitoring

The uptime monitor is now **backend-based**, storing history on the server instead of in the browser's localStorage:

- **Backend API**: `https://text.pollinations.ai/uptime`
- **Data Persistence**: Server-side file storage (uptime_data.json)
- **History**: Up to 24 hours (288 data points at 5-minute intervals)
- **Real-time Updates**: Checks models every 5 minutes
- **Endpoints**:
  - `GET /uptime` - Get all uptime data
  - `GET /uptime/:modelName` - Get specific model uptime
  - `POST /uptime/:modelName` - Record uptime check

### Backend Implementation

The backend uses a simple file-based storage system:

```javascript
// Record an uptime check
POST https://text.pollinations.ai/uptime/openai
{
  "isUp": true,
  "type": "text"
}

// Get uptime history
GET https://text.pollinations.ai/uptime/openai
```

## Project Structure

```
├── index.html    # Main HTML structure
├── styles.css    # All styling and animations
├── script.js     # Logic and backend-based uptime checker
└── README.md     # Documentation
```

## Browser Support

Works on all modern browsers: Chrome/Edge 90+, Firefox 88+, Safari 14+, Opera 76+
