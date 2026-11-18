import type { CinemaSettings, ModelDef } from "./types";

const videoMap = {
  prompt: "prompt",
  negative_prompt: "negative_prompt",
  aspect_ratio: "aspect_ratio",
  duration: "duration",
  resolution: "resolution",
  seed: "seed",
  first_frame_url: "image_url",
  last_frame_url: "end_image_url",
  reference_urls: "reference_image_urls",
};

const imageMap = {
  prompt: "prompt",
  negative_prompt: "negative_prompt",
  aspect_ratio: "aspect_ratio",
  cfg_scale: "guidance_scale",
  seed: "seed",
  reference_urls: "image_urls",
};

function v(p: Partial<ModelDef> & Pick<ModelDef, "id" | "name" | "vendor">): ModelDef {
  return {
    kind: "video",
    provider: "fal",
    endpoint: "",
    method: "POST",
    capabilities: ["t2v", "i2v"],
    paramMap: { ...videoMap },
    staticParams: "{}",
    responsePath: "video.url",
    cost: 20,
    costPerSecond: 6,
    tier: "final",
    promptStyle: "prose",
    maxDuration: 10,
    enabled: true,
    builtin: true,
    blurb: "",
    ...p,
  };
}

function i(p: Partial<ModelDef> & Pick<ModelDef, "id" | "name" | "vendor">): ModelDef {
  return {
    kind: "image",
    provider: "fal",
    endpoint: "",
    method: "POST",
    capabilities: ["t2i", "i2i"],
    paramMap: { ...imageMap },
    staticParams: "{}",
    responsePath: "images.0.url",
    cost: 2,
    costPerSecond: 0,
    tier: "final",
    promptStyle: "prose",
    maxDuration: 0,
    enabled: true,
    builtin: true,
    blurb: "",
    ...p,
  };
}

/** Out-of-the-box adapters. Endpoints are editable templates: paste your provider's exact URL and key. */
export const PRESET_MODELS: ModelDef[] = [
  v({
    id: "seedance-2-5",
    name: "Seedance 2.5",
    vendor: "ByteDance",
    endpoint: "https://fal.run/fal-ai/bytedance/seedance/v2.5/text-to-video",
    capabilities: ["t2v", "i2v", "first_last", "char_ref", "native_audio"],
    promptStyle: "timecoded",
    maxDuration: 30,
    cost: 30,
    costPerSecond: 8,
    blurb: "Multi-shot storytelling with native audio and tight character consistency.",
  }),
  v({
    id: "kling-3-0",
    name: "Kling 3.0",
    vendor: "Kuaishou",
    endpoint: "https://fal.run/fal-ai/kling-video/v3/pro/text-to-video",
    capabilities: ["t2v", "i2v", "first_last", "char_ref", "motion_transfer"],
    promptStyle: "tags",
    maxDuration: 15,
    cost: 25,
    costPerSecond: 7,
    blurb: "Photoreal motion with strong physics and start/end frame control.",
  }),
  v({
    id: "kling-4-0",
    name: "Kling 4.0",
    vendor: "Kuaishou",
    endpoint: "https://fal.run/fal-ai/kling-video/v4/pro/text-to-video",
    capabilities: ["t2v", "i2v", "first_last", "char_ref", "native_audio", "motion_transfer"],
    promptStyle: "tags",
    maxDuration: 30,
    cost: 35,
    costPerSecond: 9,
    blurb: "Next generation motion complexity with synced sound.",
  }),
  v({
    id: "veo-3-1",
    name: "Veo 3.1",
    vendor: "Google",
    provider: "vertex",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/us-central1/publishers/google/models/veo-3.1-generate:predictLongRunning",
    capabilities: ["t2v", "i2v", "first_last", "native_audio"],
    paramMap: { prompt: "instances.0.prompt", aspect_ratio: "parameters.aspectRatio", duration: "parameters.durationSeconds", seed: "parameters.seed", first_frame_url: "instances.0.image.gcsUri", last_frame_url: "instances.0.lastFrame.gcsUri" },
    responsePath: "response.videos.0.gcsUri",
    promptStyle: "prose",
    maxDuration: 8,
    cost: 40,
    costPerSecond: 10,
    blurb: "Cinematic prose prompts with dialogue, ambience and SFX cues.",
  }),
  v({
    id: "omni-flash",
    name: "Omni Flash",
    vendor: "Google",
    provider: "vertex",
    endpoint: "https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/us-central1/publishers/google/models/omni-flash:predict",
    capabilities: ["t2v", "i2v", "native_audio"],
    paramMap: { prompt: "instances.0.prompt", aspect_ratio: "parameters.aspectRatio", duration: "parameters.durationSeconds", seed: "parameters.seed" },
    responsePath: "predictions.0.videoUri",
    tier: "draft",
    cost: 8,
    costPerSecond: 2,
    maxDuration: 10,
    blurb: "Fast, cheap drafts for blocking and timing.",
  }),
  v({
    id: "wan-2-7",
    name: "Wan 2.7",
    vendor: "Alibaba",
    endpoint: "https://fal.run/fal-ai/wan/v2.7/text-to-video",
    capabilities: ["t2v", "i2v", "first_last"],
    promptStyle: "prose",
    tier: "draft",
    cost: 10,
    costPerSecond: 3,
    blurb: "Open-weight workhorse, great for previs and drafts.",
  }),
  v({
    id: "minimax-h3",
    name: "MiniMax H3",
    vendor: "MiniMax",
    provider: "rest",
    endpoint: "https://api.minimax.io/v1/video_generation",
    paramMap: { prompt: "prompt", duration: "duration", resolution: "resolution", first_frame_url: "first_frame_image", last_frame_url: "last_frame_image" },
    responsePath: "file.download_url",
    capabilities: ["t2v", "i2v", "first_last", "char_ref"],
    promptStyle: "tags",
    cost: 22,
    costPerSecond: 6,
    blurb: "Expressive faces and fluid character acting.",
  }),
  i({
    id: "nano-banana-2-1",
    name: "Nano Banana 2.1",
    vendor: "Google",
    endpoint: "https://fal.run/fal-ai/nano-banana/v2.1",
    capabilities: ["t2i", "i2i", "char_ref"],
    tier: "draft",
    cost: 1,
    blurb: "Fast edits and consistent characters from references.",
  }),
  i({
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    vendor: "Google",
    endpoint: "https://fal.run/fal-ai/nano-banana-pro",
    capabilities: ["t2i", "i2i", "char_ref"],
    cost: 3,
    blurb: "High fidelity stills and character sheets.",
  }),
  i({
    id: "flux-1-pro",
    name: "Flux.1 Pro",
    vendor: "Black Forest Labs",
    endpoint: "https://fal.run/fal-ai/flux-pro",
    cost: 3,
    blurb: "Crisp photoreal frames with strong prompt adherence.",
  }),
  i({
    id: "flux-1-dev",
    name: "Flux.1 Dev",
    vendor: "Black Forest Labs",
    endpoint: "https://fal.run/fal-ai/flux/dev",
    tier: "draft",
    cost: 1,
    blurb: "Cheap iteration on composition and lighting.",
  }),
  i({
    id: "midjourney",
    name: "Midjourney (API bridge)",
    vendor: "Midjourney",
    provider: "rest",
    endpoint: "https://your-midjourney-bridge.example/v1/imagine",
    paramMap: { prompt: "prompt" },
    promptStyle: "mj",
    responsePath: "image_url",
    cost: 4,
    blurb: "Stylised key art through a bridge service you configure.",
  }),
  i({
    id: "ideogram",
    name: "Ideogram",
    vendor: "Ideogram",
    provider: "rest",
    endpoint: "https://api.ideogram.ai/generate",
    paramMap: { prompt: "image_request.prompt", aspect_ratio: "image_request.aspect_ratio", seed: "image_request.seed", negative_prompt: "image_request.negative_prompt" },
    responsePath: "data.0.url",
    cost: 3,
    blurb: "Posters and title cards with accurate typography.",
  }),
  i({
    id: "sdxl",
    name: "Stable Diffusion XL",
    vendor: "Stability",
    endpoint: "https://fal.run/fal-ai/fast-sdxl",
    promptStyle: "weighted",
    tier: "draft",
    cost: 1,
    blurb: "Weighted tokens and negative prompts for fine control.",
  }),
  {
    ...i({ id: "seed-voice", name: "Studio Voice 1.0", vendor: "Local", endpoint: "", capabilities: [] }),
    kind: "audio",
    paramMap: { prompt: "text" },
    responsePath: "audio.url",
    cost: 1,
    blurb: "Text to speech for dialogue tracks. Uses your browser voice when no endpoint is set.",
  },
];

export const CAMERAS = ["35mm Film", "8mm Vintage", "Modern Digital", "DV Camcorder", "Classic 16mm Film", "Modular 8K Digital"];
export const LENSES = ["Anamorphic", "Vintage Prime", "Clean Spherical", "Warm Cinema Prime", "Macro", "Fisheye"];
export const APERTURES = ["f/1.4", "f/2", "f/2.8", "f/4", "f/5.6", "f/8", "f/11"];
export const FOCALS = [14, 24, 35, 50, 85, 135];
export const MOVES = ["Dolly In", "Dolly Out", "Orbit", "Crane Up", "Crane Down", "Pan Left", "Pan Right", "Zoom In", "Zoom Out", "Handheld", "Static"];
export const LIGHTING = ["Golden Hour", "Overcast Soft", "Neon Night", "Low-Key Noir", "High-Key Studio", "Candlelight", "Moonlight Blue"];
export const GENRES = ["Drama", "Thriller", "Romance", "Action", "Horror", "Sci-Fi", "Comedy", "Documentary"];
export const ASPECTS = [
  { id: "9:16", label: "9:16", hint: "Vertical drama / social" },
  { id: "21:9", label: "21:9", hint: "Widescreen cinema" },
  { id: "16:9", label: "16:9", hint: "Standard" },
  { id: "1:1", label: "1:1", hint: "Square" },
];

export const DEFAULT_SETTINGS: CinemaSettings = {
  camera: "35mm Film",
  lens: "Anamorphic",
  focal: 35,
  aperture: "f/2",
  lighting: "Golden Hour",
  genre: "Drama",
  moves: [{ type: "Dolly In", amount: 50 }],
  tempo: 40,
  aspect: "16:9",
  duration: 5,
  resolution: "1080p",
  audio: true,
};

export function tempoLabel(t: number) {
  if (t < 20) return "Slow / Calm";
  if (t < 45) return "Measured";
  if (t < 70) return "Driving";
  if (t < 88) return "Urgent";
  return "Fast / Tense";
}
