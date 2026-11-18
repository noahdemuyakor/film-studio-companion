export type ModelKind = "video" | "image" | "audio";
export type ProviderType = "rest" | "fal" | "replicate" | "vertex" | "openrouter" | "webhook";

export const PROVIDERS: { id: ProviderType; label: string }[] = [
  { id: "rest", label: "REST API" },
  { id: "fal", label: "fal.ai" },
  { id: "replicate", label: "Replicate" },
  { id: "vertex", label: "Vertex AI" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "webhook", label: "Local Webhook" },
];

export type Capability =
  | "t2i"
  | "i2i"
  | "t2v"
  | "i2v"
  | "first_last"
  | "char_ref"
  | "native_audio"
  | "motion_transfer";

export const CAPABILITIES: { id: Capability; label: string }[] = [
  { id: "t2i", label: "Text-to-Image" },
  { id: "i2i", label: "Image-to-Image" },
  { id: "t2v", label: "Text-to-Video" },
  { id: "i2v", label: "Image-to-Video" },
  { id: "first_last", label: "First/Last Frame Control" },
  { id: "char_ref", label: "Character Reference" },
  { id: "native_audio", label: "Native Audio" },
  { id: "motion_transfer", label: "Motion Transfer" },
];

/** App-side controls that can be mapped onto any model's payload keys. */
export const APP_PARAMS = [
  "prompt",
  "negative_prompt",
  "aspect_ratio",
  "duration",
  "resolution",
  "cfg_scale",
  "seed",
  "reference_urls",
  "first_frame_url",
  "last_frame_url",
  "audio",
] as const;
export type AppParam = (typeof APP_PARAMS)[number];

/** How a model prefers its prompt to be written; the prompt compiler targets this. */
export type PromptStyle =
  | "prose" // natural cinematic prose
  | "tags" // comma separated descriptors
  | "timecoded" // [0-3s] shot beats
  | "weighted" // (token:1.2) weights + negative prompt
  | "mj"; // --ar / --style flags

export interface ModelDef {
  id: string;
  name: string;
  vendor: string;
  kind: ModelKind;
  provider: ProviderType;
  endpoint: string;
  method: "POST" | "GET";
  apiKeyEnc?: string; // AES-GCM encrypted on this device
  capabilities: Capability[];
  paramMap: Partial<Record<AppParam, string>>;
  staticParams: string; // JSON object merged into payload
  responsePath: string; // dot path to the result URL
  cost: number; // credits per generation (base)
  costPerSecond: number; // extra credits per second of video
  tier: "draft" | "final";
  promptStyle: PromptStyle;
  maxDuration: number;
  /** exact clip lengths (seconds) the model accepts, when its platforms publish them */
  durations?: number[];
  /** output resolutions the model accepts (e.g. 480p, 720p, 1080p, 4K), when its platforms publish them */
  resolutions?: string[];
  enabled: boolean;
  builtin: boolean;
  blurb: string;
  adapterCode?: string;
  notes?: string;
}

export type RefKind = "character" | "prop" | "location" | "style" | "audio";

export interface VaultRef {
  id: string;
  kind: RefKind;
  name: string;
  description: string;
  dataUrl?: string; // small thumbnail or audio data
  tags: string[];
  createdAt: number;
}

export interface Wardrobe {
  id: string;
  name: string;
  description: string;
}

export interface CastMember {
  id: string;
  name: string;
  role: string;
  face: string; // face anchor descriptors
  faceRefId?: string; // vault ref id
  wardrobe: Wardrobe[];
  activeWardrobe: string;
  voice: { name: string; style: string; pitch: number };
  styleTags: string[];
  locked: boolean;
  color: string;
}

export interface CinemaSettings {
  camera: string;
  lens: string;
  focal: number;
  aperture: string;
  lighting: string;
  genre: string;
  moves: { type: string; amount: number }[];
  tempo: number; // 0 calm .. 100 tense
  aspect: string;
  duration: number;
  resolution: string;
  audio: boolean;
}

export interface Shot {
  id: string;
  title: string;
  prompt: string;
  compiled: string;
  continuity: string;
  modelId: string;
  settings: CinemaSettings;
  refIds: string[];
  castIds: string[];
  firstFrame?: string; // shot id or ref id it is locked to
  lastFrameLocked?: boolean;
  extendBack: number;
  extendForward: number;
  status: "idle" | "compiling" | "rendering" | "done" | "error";
  resultUrl?: string;
  simulated?: boolean;
  seed: number;
  credits: number;
  payload?: unknown;
  error?: string;
  createdAt: number;
  engine?: "live" | "local";
  platformId?: string | null;
  route?: string;
  /** the platform's own id for the result (e.g. a Flick job id), so it can be a first frame or reference there */
  nativeId?: string;
}

/** an image passed into a render: the first frame of a video, or a reference */
export interface MediaInput {
  role: "first" | "ref";
  url?: string;
  native?: { platformId: string; id: string };
}

export interface DialogueLine {
  character: string;
  line: string;
}

export interface ShotPlan {
  id: string;
  description: string;
  shotType: string;
  movement: string;
  duration: number;
  characters: string[];
}

export interface Scene {
  id: string;
  title: string;
  location: string;
  beat: string;
  emotion: string;
  intensity: number; // 0..10
  summary: string;
  dialogue: DialogueLine[];
  shots: ShotPlan[];
}

export interface Episode {
  id: string;
  title: string;
  logline: string;
  script: string;
  scenes: Scene[];
  engine?: "live" | "local";
  updatedAt: number;
  /** this project's own timeline (saved when you switch projects) */
  clips?: Clip[];
}

export type TrackId = "video" | "dialogue" | "sfx" | "music";

export interface Clip {
  id: string;
  track: TrackId;
  start: number;
  duration: number;
  label: string;
  shotId?: string;
  seed: number;
  transition: "cut" | "fade" | "dissolve";
  subtitle?: string;
  url?: string;
}

/* ---------------- Platform bridge & wallet (part 5) ---------------- */
export type BridgeMode = "mcp-remote" | "mcp-stdio" | "cli" | "api";
export type RouteMode = "cheapest" | "lock" | "preflight";

export interface McpTool {
  name: string;
  description?: string;
  role?: "generate" | "status" | "balance" | "models" | "assets" | "other";
}

export interface Platform {
  id: string;
  name: string;
  mode: BridgeMode;
  enabled: boolean;
  url: string; // remote MCP endpoint or REST base URL
  mcpConfig: string; // { "mcpServers": { ... } } for local stdio servers
  command: string; // CLI executable
  argTemplate: string; // CLI flags with {placeholders}
  submitPath: string; // API: submit_job
  pollPath: string; // API: poll_status ({id})
  assetPath: string; // API: dot path to asset URL in the finished job
  balancePath: string; // API path or MCP tool name for live balance
  tokenEnc?: string;
  balance: number;
  balanceSource: "live" | "manual";
  allotment: number;
  period: "monthly" | "daily";
  threshold: number; // keep at least this many credits
  models: Record<string, number>; // registry model id -> credits per render on this platform
  features: string[];
  tools: McpTool[];
  status: "disconnected" | "connected" | "error";
  lastSync?: number;
  note?: string;
  bridgeCode?: string;
  sample?: boolean;
  /** which built-in adapter drives real renders on this platform (detected from its tools) */
  adapter?: "flick" | "openart" | "imagineart" | "flow" | "pixmax";
  /** per-platform choices the adapter needs: Flick project, ImagineArt organization */
  adapterConfig?: { projectId?: string; projectName?: string; orgId?: string };
  /** registry model id -> this platform's own model id (and OpenArt mode) */
  nativeModels?: Record<string, { id: string; mode?: string; kind: ModelKind; durations?: number[]; resolutions?: string[] }>;
}

export interface LedgerEntry {
  id: string;
  platformId: string;
  delta: number;
  reason: string;
  at: number;
  after: number;
  source: "live" | "estimate" | "manual";
}

export interface RoutePlan {
  platformId: string | null; // null = call the model's own endpoint from the registry
  cost: number;
  reason: string;
  failover: boolean;
  alternatives: { platformId: string; cost: number; ok: boolean; why: string }[];
  /** set when the person chose a platform that can't run this: nothing is rendered or spent */
  blocked?: string;
}

export interface EngineLog {
  id: string;
  task: string;
  mode: "live" | "local";
  model: string;
  at: number;
  ms: number;
  ok: boolean;
  note?: string;
}
