#!/bin/bash

# Script to set up Cloudflare Vectorize for the text cache worker
# This script creates the Vectorize index and deploys the worker

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check if wrangler is installed
if ! command_exists wrangler; then
  echo -e "${YELLOW}Wrangler not found. Installing...${NC}"
  npm install -g wrangler
fi

# Check if user is logged in to Cloudflare
echo -e "${GREEN}Checking Cloudflare login status...${NC}"
LOGGED_IN=$(wrangler whoami 2>&1 | grep -c "You are logged in")

if [ "$LOGGED_IN" -eq 0 ]; then
  echo -e "${YELLOW}Not logged in to Cloudflare. Please log in:${NC}"
  wrangler login
fi

# Create the Vectorize index if it doesn't exist
echo -e "${GREEN}Creating Vectorize index for text cache...${NC}"
INDEX_EXISTS=$(wrangler vectorize list 2>&1 | grep -c "pollinations-text-cache")

if [ "$INDEX_EXISTS" -eq 0 ]; then
  echo -e "${YELLOW}Creating new Vectorize index 'pollinations-text-cache'...${NC}"
  wrangler vectorize create pollinations-text-cache --dimensions=32 --metric=euclidean
  
  # Create metadata index for the url field
  echo -e "${YELLOW}Creating metadata index for 'url' field...${NC}"
  wrangler vectorize create-metadata-index pollinations-text-cache --property-name=url --type=string
  
  # Create metadata index for the cacheKey field
  echo -e "${YELLOW}Creating metadata index for 'cacheKey' field...${NC}"
  wrangler vectorize create-metadata-index pollinations-text-cache --property-name=cacheKey --type=string
else
  echo -e "${GREEN}Vectorize index 'pollinations-text-cache' already exists.${NC}"
fi

# Deploy the worker
echo -e "${GREEN}Deploying worker...${NC}"
wrangler deploy

echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}Your worker is now deployed with Vectorize integration.${NC}"
echo -e "${YELLOW}To test the vector cache functionality, use the /vectorcache endpoint.${NC}"
echo -e "${YELLOW}Example: https://text.pollinations.ai/vectorcache/completion${NC}"
