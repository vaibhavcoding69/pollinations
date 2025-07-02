import os

# Set custom HF cache directory BEFORE importing any HuggingFace libraries
hf_cache_dir = os.path.join(os.getcwd(), "hf_cache")
os.makedirs(hf_cache_dir, exist_ok=True)
os.environ["HF_HOME"] = hf_cache_dir
os.environ["HUGGINGFACE_HUB_CACHE"] = hf_cache_dir

import torch
from diffusers import StableDiffusionPipeline

from nunchaku import NunchakuFluxTransformer2dModel
from nunchaku.utils import get_precision

# Just print information about Nunchaku installation
print(f"Nunchaku installation verified!")
print(f"Detected precision: {get_precision()}")
print(f"CUDA available: {torch.cuda.is_available()}")
print(f"CUDA device count: {torch.cuda.device_count()}")
if torch.cuda.is_available():
    print(f"CUDA device name: {torch.cuda.get_device_name(0)}")
