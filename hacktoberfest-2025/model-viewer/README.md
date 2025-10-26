# Model Viewer with Uptime Monitoring

Feature-rich viewer for Pollinations AI models with **backend-based** real-time uptime monitoring.

## Features

- **17+ AI Models** - Dynamically fetched from API
- **Backend Uptime Monitoring** - Independent service tracks model availability 24/7
- **Real-time Status** - Visual history bars and percentage tracking
- **AI Insights** - Curated descriptions for each model
- **Advanced Filters** - Search, filter by tier/capabilities, multiple view modes

## Architecture

### Frontend (`index.html`, `script.js`, `styles.css`)
Pure HTML/CSS/JS viewer - fetches models dynamically, displays uptime from backend

### Backend (`uptime-backend.js`)
Independent Node.js service - checks models every 5 minutes, stores 24h history, provides REST API

## Running

```bash
# Backend
npm install
npm start

# Frontend
# Just open index.html in browser
```

## API

- `GET /api/uptime` - All models
- `GET /api/uptime/:modelName` - Specific model with %

## Deploy

**Backend**: Railway, Render, Fly.io, or Cloudflare Workers  
**Frontend**: Any static host (GitHub Pages, Netlify, etc.)

Configure backend URL in `script.js`
