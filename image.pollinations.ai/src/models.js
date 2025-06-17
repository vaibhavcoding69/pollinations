export const MODELS = {
  flux: {
    provider: "cloudflare",
    enhance: true,
    maxSideLength: 1280,
    tier: "anonymous",
    // Newly added descriptive & modality keys
    description: "Cloudflare FLUX-1 Schnell",
    aliases: "flux-1-schnell",
    input_modalities: ["text"],
    output_modalities: ["image"],
    pricing: {
      // Cloudflare Flux pricing (April 2025)
      perTile: 0.0000528, // $ per 512×512 tile
      perStep: 0.0001056, // $ per diffusion step
      tileSize: 512, // Tile dimension for calculation
      defaultSteps: 25, // Default steps used in our implementation (Cloudflare examples use 25-30)
    },
  },
  turbo: {
    provider: "pollinations",
    enhance: true,
    maxSideLength: 768,
    tier: "seed",
    // Newly added descriptive & modality keys
    description: "Pollinations Turbo Image Model (ComfyUI)",
    aliases: "turbo-flux",
    input_modalities: ["text"],
    output_modalities: ["image"],
    pricing: {
      // Turbo runs on Pollinations infrastructure using ComfyUI
      // Using same tile+step pricing model as Flux for consistency
      perTile: 0.0000528, // $ per 512×512 tile (same as Flux)
      perStep: 0.0001056, // $ per diffusion step (same as Flux)
      tileSize: 512, // Tile dimension for calculation
      // Dynamic steps: 1-6 based on server load (concurrentRequests)
      minSteps: 1,
      maxSteps: 6,
      note: "ComfyUI infrastructure - dynamic steps based on load",
    },
  },
  gptimage: {
    provider: "azure",
    enhance: false,
    maxSideLength: 1024,
    tier: "flower",
    // Newly added descriptive & modality keys
    description: "Azure GPT-Image-1",
    aliases: "gpt-image-1",
    input_modalities: ["text", "image"],
    output_modalities: ["image"],
    pricing: {
      // GPT-image-1 pricing per million tokens
      textInput: 5.0, // $5 per 1M tokens
      textInputCached: 1.25, // $1.25 per 1M tokens (cached)
      imageInput: 10.0, // $10 per 1M tokens
      imageInputCached: 2.5, // $2.50 per 1M tokens (cached)
      imageOutput: 40.0, // $40 per 1M tokens
      // Token calculation parameters
      lowDetailTokens: 85,
      highDetailBaseTokens: 85,
      highDetailTileTokens: 170,
    },
  },
};
