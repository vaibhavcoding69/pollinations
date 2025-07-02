import os

# Set custom HF cache directory BEFORE importing any HuggingFace libraries
hf_cache_dir = os.path.join(os.getcwd(), "hf_cache")
os.makedirs(hf_cache_dir, exist_ok=True)
os.environ["HF_HOME"] = hf_cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = hf_cache_dir

import torch
from diffusers import FluxKontextPipeline
from diffusers.utils import load_image

from nunchaku import NunchakuFluxTransformer2dModel
from nunchaku.utils import get_precision

# Load the quantized transformer model
transformer = NunchakuFluxTransformer2dModel.from_pretrained(
    f"mit-han-lab/nunchaku-flux.1-kontext-dev/svdq-{get_precision()}_r32-flux.1-kontext-dev.safetensors",
    cache_dir=hf_cache_dir
)

# Create the pipeline
pipeline = FluxKontextPipeline.from_pretrained(
    "black-forest-labs/FLUX.1-Kontext-dev", 
    transformer=transformer, 
    torch_dtype=torch.bfloat16,
    cache_dir=hf_cache_dir,
    use_auth_token=True  # Explicitly use the logged-in token
).to("cuda")

# Load an example image (you can use any image)
image = load_image(
    "https://huggingface.co/datasets/huggingface/documentation-images/resolve/main/diffusers/yarn-art-pikachu.png"
).convert("RGB")

# Generate an edited image
prompt = "Make Pikachu hold a sign that says 'Nunchaku is awesome', yarn art style, detailed, vibrant colors"
result = pipeline(image=image, prompt=prompt, guidance_scale=2.5).images[0]
result.save("flux-kontext-dev-output.png")
print("Image saved as flux-kontext-dev-output.png")
