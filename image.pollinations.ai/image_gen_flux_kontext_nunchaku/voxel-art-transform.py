import os

# Set custom HF cache directory BEFORE importing any HuggingFace libraries
hf_cache_dir = os.path.join(os.getcwd(), "hf_cache")
os.makedirs(hf_cache_dir, exist_ok=True)
os.environ["HF_HOME"] = hf_cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = hf_cache_dir

# Read the token directly
try:
    token_path = os.path.expanduser('~/.cache/huggingface/token')
    if os.path.exists(token_path):
        with open(token_path, 'r') as f:
            hf_token = f.read().strip()
        os.environ["HUGGING_FACE_HUB_TOKEN"] = hf_token
        print(f"Using Hugging Face token from: {token_path}")
    else:
        print("No Hugging Face token found")
except Exception as e:
    print(f"Error reading token: {e}")

import torch
import time
from diffusers import FluxKontextPipeline
from diffusers.utils import load_image
from PIL import Image

from nunchaku import NunchakuFluxTransformer2dModel
from nunchaku.utils import get_precision

# Load the quantized transformer model
transformer = NunchakuFluxTransformer2dModel.from_pretrained(
    f"mit-han-lab/nunchaku-flux.1-kontext-dev/svdq-{get_precision()}_r32-flux.1-kontext-dev.safetensors",
    cache_dir=hf_cache_dir
)

# Create the pipeline
try:
    # Try with directly providing token
    print("Using explicit token authentication")
    pipeline = FluxKontextPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-Kontext-dev", 
        transformer=transformer, 
        torch_dtype=torch.bfloat16,
        cache_dir=hf_cache_dir,
            token=hf_token  # Explicitly provide the token
    ).to("cuda")

except Exception as e:
    print(f"Error loading the model: {e}")
    print("\nNOTE: You may need to manually accept the license terms for FLUX.1-Kontext-dev.")
    print("Visit https://huggingface.co/black-forest-labs/FLUX.1-Kontext-dev in your browser")
    print("and accept the terms before running this script.")
    exit(1)

# Start timing
start_time = time.time()

# Load the local image
print("Loading image: test.png")
image = Image.open("test.png").convert("RGB")

# Generate a voxel art transformation
prompt = "Make this male into a pixel art elf. 8bit style"
print(f"Applying prompt: {prompt}")

# You can adjust guidance_scale for stronger/weaker adherence to the prompt
# Lower values (e.g., 1.0-2.0) keep more of the original image
# Higher values (e.g., 3.0-7.0) follow the prompt more strongly
result = pipeline(
    image=image, 
    prompt=prompt, 
    guidance_scale=2.5,
    num_inference_steps=10  # Increase for better quality but slower processing
).images[0]

# Calculate elapsed time
end_time = time.time()
elapsed_time = end_time - start_time
print(f"Processing completed in {elapsed_time:.2f} seconds ({elapsed_time/60:.2f} minutes)")

# Save the result
output_filename = "voxel-art-output.png"
result.save(output_filename)
print(f"Image saved as {output_filename}")
