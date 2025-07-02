import os
import io
import time
import logging
import sys
from datetime import datetime
from typing import Optional, Dict, Any
import asyncio
import torch
from fastapi import FastAPI, File, Form, UploadFile, HTTPException, Request, status, Depends, Header
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
from PIL import Image, ImageFile
from diffusers import FluxKontextPipeline
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Global semaphore to limit concurrency
semaphore = asyncio.Semaphore(1)  # Only allow one request at a time

# Load API token from environment
API_TOKEN = os.getenv("API_TOKEN")
if not API_TOKEN:
    logger.error("API_TOKEN not found in environment variables")
    raise ValueError("API_TOKEN must be set in .env file")

# Authentication dependency
def verify_api_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header format. Use 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    token = authorization.split(" ")[1]
    if token != API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    return token
from nunchaku import NunchakuFluxTransformer2dModel
from nunchaku.utils import get_precision

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Enable PIL logging for image processing
logging.getLogger('PIL').setLevel(logging.INFO)

# Enable more verbose logging for debugging if needed
# logging.basicConfig(level=logging.DEBUG)

# Set custom HF cache directory BEFORE importing any HuggingFace libraries
hf_cache_dir = os.path.join(os.getcwd(), "hf_cache")
try:
    os.makedirs(hf_cache_dir, exist_ok=True)
    os.environ["HF_HOME"] = hf_cache_dir
    os.environ["HUGGINGFACE_HUB_CACHE"] = hf_cache_dir
    logger.info(f"Set Hugging Face cache directory to: {hf_cache_dir}")
except Exception as e:
    logger.error(f"Failed to set up cache directory: {str(e)}")
    raise

# Read the token directly
hf_token = None
try:
    token_path = os.path.expanduser('~/.cache/huggingface/token')
    if os.path.exists(token_path):
        with open(token_path, 'r') as f:
            hf_token = f.read().strip()
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token
        logger.info(f"Successfully loaded Hugging Face token from: {token_path}")
    else:
        logger.warning("No Hugging Face token found. Some features may be limited.")
except Exception as e:
    logger.error(f"Error reading Hugging Face token: {str(e)}")

# Create FastAPI app
app = FastAPI(
    title="Flux Kontext Voxel Art API",
    description="API for generating and transforming images using FLUX.1-Kontext model",
    version="1.0.0"
)

# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(hash(f"{time.time()}{request.client.host}"))
    logger.info(f"Request {request_id} started: {request.method} {request.url}")
    
    try:
        start_time = time.time()
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        logger.info(
            f"Request {request_id} completed: "
            f"status={response.status_code} "
            f"process_time={process_time:.2f}ms"
        )
        
        return response
    except Exception as e:
        logger.error(f"Request {request_id} failed: {str(e)}", exc_info=True)
        raise

# Global variables for model and pipeline
transformer = None
pipeline = None
model_loaded = False

# Initialize model
@app.on_event("startup")
async def startup_event():
    global transformer, pipeline, model_loaded
    
    logger.info("Starting application initialization...")
    start_time = time.time()
    
    try:
        # Log system info
        logger.info(f"Python version: {sys.version}")
        logger.info(f"PyTorch version: {torch.__version__}")
        logger.info(f"CUDA available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            logger.info(f"CUDA device: {torch.cuda.get_device_name(0)}")
            logger.info(f"CUDA memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.2f} GB")
        
        # Load transformer model
        transformer_path = f"mit-han-lab/nunchaku-flux.1-kontext-dev/svdq-{get_precision()}_r32-flux.1-kontext-dev.safetensors"
        logger.info(f"Loading transformer model from: {transformer_path}")
        
        transformer = NunchakuFluxTransformer2dModel.from_pretrained(
            transformer_path,
            cache_dir=hf_cache_dir
        )
        logger.info("Transformer model loaded successfully")
        
        # Create pipeline
        logger.info("Initializing FluxKontextPipeline...")
        pipeline = FluxKontextPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-Kontext-dev", 
            transformer=transformer, 
            torch_dtype=torch.bfloat16,
            cache_dir=hf_cache_dir,
            token=hf_token
        ).to("cuda")
        
        # Warm up the model with a simple prompt
        logger.info("Warming up the model...")
        with torch.no_grad():
            _ = pipeline(
                prompt="warmup",
                num_inference_steps=1,
                guidance_scale=1.0,
                width=64,  # Use minimal dimensions for warm-up
                height=64
            )
        
        model_loaded = True
        init_time = time.time() - start_time
        logger.info(f"Application initialization completed in {init_time:.2f} seconds")
        
    except Exception as e:
        error_msg = f"Failed to initialize application: {str(e)}"
        logger.error(error_msg, exc_info=True)
        logger.error("\nNOTE: You may need to manually accept the license terms for FLUX.1-Kontext-dev.")
        logger.error("Visit https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev in your browser")
        logger.error("and accept the terms before running this server.")
        raise RuntimeError(error_msg)

# Models for request validation
class TransformRequest(BaseModel):
    prompt: str
    guidance_scale: float = 2.5
    num_inference_steps: int = 10
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    
    class Config:
        schema_extra = {
            "example": {
                "prompt": "Make this image into a pixel art elf. 8bit style",
                "guidance_scale": 2.5,
                "num_inference_steps": 10,
                "width": 768,
                "height": 768
            }
        }

@app.get("/", tags=["Status"])
async def root():
    """Root endpoint to check if the API is running."""
    logger.info("Root endpoint accessed")
    return {
        "message": "Flux Kontext Voxel Art API is running",
        "status": "operational" if model_loaded else "initializing",
        "model_loaded": model_loaded,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/generate", response_class=Response, responses={
    200: {"content": {"image/jpeg": {}}},
    400: {"description": "Invalid request parameters"},
    500: {"description": "Internal server error"}
})
async def generate_image(
    request: Request,
    prompt: str = Form(..., description="Text prompt for image generation/transformation"),
    guidance_scale: float = Form(2.5, ge=1.0, le=20.0, description="Guidance scale for generation"),
    num_inference_steps: int = Form(10, ge=1, le=100, description="Number of inference steps"),
    width: Optional[int] = Form(1024, ge=64, le=2048, description="Width of the output image"),
    height: Optional[int] = Form(1024, ge=64, le=2048, description="Height of the output image"),
    image: Optional[UploadFile] = File(None, description="Optional input image for transformation"),
    token: str = Depends(verify_api_token)
):
    """Generate or transform an image based on the provided prompt and parameters."""
    # Acquire semaphore - this will queue the request if another is processing
    request_id = id(request)
    logger.info(f"Request {request_id} queued - waiting for processing slot")
    await semaphore.acquire()
    
    try:
        start_time = time.time()
        logger.info(f"Request {request_id} started processing - Prompt: '{prompt[:50]}...'")
        
        # Check if model is loaded
        global model_loaded, pipeline
        if not model_loaded or pipeline is None:
            error_msg = "Model not loaded. Please check the service status."
            logger.error(error_msg)
            raise HTTPException(status_code=503, detail=error_msg)
        
        # Log memory usage before processing
        if torch.cuda.is_available():
            torch.cuda.synchronize()
            mem_alloc = torch.cuda.memory_allocated() / 1024**2
            mem_reserved = torch.cuda.memory_reserved() / 1024**2
            logger.debug(f"GPU memory - Allocated: {mem_alloc:.2f}MB, Reserved: {mem_reserved:.2f}MB")
        
        # Process image if provided
        if image:
            logger.info(f"Processing image upload: {image.filename} ({image.content_type})")
            try:
                image_data = await image.read()
                logger.debug(f"Read {len(image_data)} bytes of image data")
                
                img_start = time.time()
                img = Image.open(io.BytesIO(image_data)).convert("RGB")
                img_load_time = time.time() - img_start
                logger.debug(f"Image loaded in {img_load_time:.2f}s")
                
                # Log input image details
                img_width, img_height = img.size
                logger.info(f"Input image size: {img_width}x{img_height}, converting to {width}x{height}")
                
                # Process the image
                process_start = time.time()
                result = pipeline(
                    image=img,
                    prompt=prompt,
                    guidance_scale=guidance_scale,
                    num_inference_steps=num_inference_steps,
                    width=width,
                    height=height
                ).images[0]
                process_time = time.time() - process_start
                logger.info(f"Image processing completed in {process_time:.2f}s")
                
            except Exception as img_error:
                logger.error(f"Error processing image: {str(img_error)}", exc_info=True)
                raise HTTPException(status_code=400, detail=f"Invalid image: {str(img_error)}")
        else:
            # Generate image from text prompt only
            logger.info("Generating image from text prompt only")
            process_start = time.time()
            result = pipeline(
                prompt=prompt,
                guidance_scale=guidance_scale,
                num_inference_steps=num_inference_steps,
                width=width,
                height=height
            ).images[0]
            process_time = time.time() - process_start
            logger.info(f"Image generation completed in {process_time:.2f}s")
        
        # Calculate total processing time
        elapsed_time = time.time() - start_time
        actual_width, actual_height = result.size
        
        # Log generation stats
        logger.info(
            f"Generation completed - "
            f"Time: {elapsed_time:.2f}s, "
            f"Resolution: {actual_width}x{actual_height}, "
            f"Prompt: '{prompt[:30]}...'"
        )
        
        # Prepare response
        buffered = io.BytesIO()
        save_start = time.time()
        result.save(buffered, format="JPEG", quality=95, optimize=True)
        buffered.seek(0)
        save_time = time.time() - save_start
        logger.debug(f"Image encoded to JPEG in {save_time:.2f}s, size: {len(buffered.getvalue())} bytes")
        
        # Add metadata headers
        headers = {
            "X-Processing-Time": f"{elapsed_time:.2f}",
            "X-Requested-Resolution": f"{width}x{height}",
            "X-Actual-Resolution": f"{actual_width}x{actual_height}",
            "X-Inference-Steps": str(num_inference_steps),
            "X-Guidance-Scale": f"{guidance_scale:.1f}",
            "X-Request-ID": str(request_id)
        }
        
        return Response(
            content=buffered.getvalue(),
            media_type="image/jpeg",
            headers=headers
        )
    
    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Error processing request: {str(e)}"
        logger.error(f"Request {request_id} failed: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)
    finally:
        # Always release the semaphore when done
        semaphore.release()
        logger.info(f"Request {request_id} completed - Semaphore released")

@app.get("/health", tags=["Status"])
async def health_check():
    """Health check endpoint to verify the service is running and models are loaded."""
    health_status = {
        "status": "healthy" if model_loaded else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "model_loaded": model_loaded,
        "gpu_available": torch.cuda.is_available(),
        "system": {
            "python_version": sys.version.split()[0],
            "platform": sys.platform,
            "cuda_version": torch.version.cuda if torch.cuda.is_available() else None
        }
    }
    
    if torch.cuda.is_available():
        try:
            device = torch.cuda.current_device()
            health_status["gpu"] = {
                "name": torch.cuda.get_device_name(device),
                "memory": {
                    "allocated": f"{torch.cuda.memory_allocated(device) / 1024**2:.2f}MB",
                    "reserved": f"{torch.cuda.memory_reserved(device) / 1024**2:.2f}MB",
                    "total": f"{torch.cuda.get_device_properties(device).total_memory / 1024**3:.2f}GB"
                }
            }
        except Exception as e:
            logger.error(f"Error getting GPU info: {str(e)}")
            health_status["gpu_error"] = str(e)
    
    status_code = 200 if model_loaded else 503
    
    if status_code != 200:
        health_status["error"] = "Model pipeline not initialized"
        logger.warning("Health check failed: Model pipeline not initialized")
    else:
        logger.info("Health check passed")
    
    return JSONResponse(
        status_code=status_code,
        content=health_status
    )

if __name__ == "__main__":
    import uvicorn
    
    # Configure uvicorn logging
    log_config = uvicorn.config.LOGGING_CONFIG
    log_config["formatters"]["default"]["fmt"] = "%(asctime)s - %(levelprefix)s %(message)s"
    log_config["formatters"]["access"]["fmt"] = '%(asctime)s - %(levelprefix)s %(client_addr)s - "%(request_line)s" %(status_code)s'
    
    logger.info("Starting Uvicorn server...")
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        log_config=log_config,
        reload=False,
        workers=1,  # Multiple workers might cause issues with GPU models
        limit_concurrency=4,  # Limit concurrent requests to prevent OOM
        timeout_keep_alive=30  # Close idle connections after 30 seconds
    )

# running at http://51.159.184.240:8000/