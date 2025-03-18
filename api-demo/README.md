# Pollinations API URL Configurator

A simple React application to configure and test URLs for the Pollinations.AI API services.

## Overview

This application provides a user-friendly interface to:

1. Select between Text and Image generation APIs
2. Choose from available models
3. Configure API parameters
4. Generate and view responses directly in the application

The configurator dynamically updates the parameters based on the selected endpoint and displays the resulting API URL.

## Features

- Switch between Text and Image API endpoints
- View available models for each endpoint
- Configure endpoint-specific parameters:
  - Text API: prompt, model, seed, json, system, private
  - Image API: prompt, model, seed, width, height, no-logo, private, enhance, safe
- Preview the generated API URL with copy functionality
- View API responses directly in the interface:
  - Display generated images for the Image API
  - Display text responses for the Text API
  - Format JSON responses when applicable

## Technologies Used

- React with TypeScript
- Material UI for components
- Axios for API requests

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn

### Installation

1. Clone the repository
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

### Running the Application

Start the development server:

```bash
npm start
```

The application will be available at [http://localhost:3000](http://localhost:3000).

### Connecting to Local API Endpoints

By default, the application is configured to use the production Pollinations.AI APIs. If you want to connect to local instances of the APIs:

1. Make sure your local instances are running:
   - Text API typically runs on port 16385
   - Image API typically runs on port 3000

2. Configure the environment variables in the `.env` file:
   ```
   REACT_APP_USE_LOCAL_API=true
   REACT_APP_TEXT_API_PORT=16385
   REACT_APP_IMAGE_API_PORT=3000
   ```

The application uses HTTP proxy middleware to redirect API requests to your local instances.

## Usage

1. Select an endpoint (Text or Image)
2. Choose a model from the dropdown list
3. Enter your prompt
4. Configure additional parameters as needed
5. Click "Generate Response" to see the result directly in the application

## API Documentation

For more information about the Pollinations API, refer to the [official API documentation](https://github.com/pollinations/pollinations/blob/master/APIDOCS.md).

## License

This project is open-source and available under the MIT License.
