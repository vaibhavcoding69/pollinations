#!/bin/bash

# Script to run the worker in development mode
# This script starts a local development server for testing

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting development server...${NC}"
echo -e "${YELLOW}This will simulate the worker environment locally for testing.${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server.${NC}"

# Start the development server
npx wrangler dev --local

# Note: The --local flag runs the worker without connecting to Cloudflare
# This is useful for testing without affecting production
