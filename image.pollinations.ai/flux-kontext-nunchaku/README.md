# Flux Kontext Nunchaku

FLUX.1-Kontext image generation service with Nunchaku optimization, integrated into the Pollinations monorepo.

## Overview

This service provides a FastAPI-based REST API for FLUX.1-Kontext image generation with Nunchaku optimization.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Run the server:
   ```bash
   python app.py
   ```
   
   The server will start on http://0.0.0.0:8000

## API Endpoints

### GET `/`
Basic health check to verify the API is running.

### GET `/health`
Detailed health check to verify the model is properly loaded.

### POST `/generate`
Generate an image using the Flux Kontext model. Can either transform an existing image or generate a new one from a prompt.

**Parameters:**
- `image`: (Optional) The image file to transform. If not provided, will generate a new image from the prompt
- `prompt`: (Required) Text prompt describing the desired transformation or generation
- `guidance_scale`: (Optional, default: 2.5) Controls adherence to prompt (1.0-7.0)
- `num_inference_steps`: (Optional, default: 10) Number of inference steps

**Example curl requests:**

With image (transformation):
```bash
curl -X POST http://localhost:8000/generate \
  -F "image=@path/to/your/image.png" \
  -F "prompt=Make this into a pixel art elf. 8bit style" \
  -F "guidance_scale=2.5" \
  -F "num_inference_steps=10"
```

Without image (pure generation):
```bash
curl -X POST http://localhost:8000/generate \
  -F "prompt=Create a pixel art elf character. 8bit style" \
  -F "guidance_scale=2.5" \
  -F "num_inference_steps=10"
```

**Response:**
A binary JPEG image is returned directly with the following HTTP header:
- `X-Processing-Time`: Time taken to process the image in seconds

This makes it easy to use the API in image tags, download links, or when streaming the image directly to clients.

## Notes

- The server requires a GPU with CUDA support
- You may need to accept the license terms for FLUX.1-Kontext-dev on Hugging Face before first use
- Adjust `guidance_scale` to control how closely the result adheres to your prompt:
  - Lower values (e.g., 1.0-2.0) keep more of the original image
  - Higher values (e.g., 3.0-7.0) follow the prompt more strongly
