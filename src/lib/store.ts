"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Edge, Node } from "@xyflow/react";
import type { CastMember, CinemaSettings, Clip, EngineLog, Episode, LedgerEntry, ModelDef, Platform, RouteMode, Shot, VaultRef } from "./types";
import { PRESET_PLATFORMS } from "./platforms";
import { DEFAULT_SETTINGS, PRESET_MODELS } from "./presets";
import { uid } from "./util";

export const VAULT_LIMIT = 50;

export const SAMPLE_SCRIPT = `EPISODE 1 — THE LAST FERRY

EXT. HARBOUR PIER — GOLDEN HOUR
Wind snaps the flags. MAYA (28) walks the pier with a sealed envelope, scanning the boats.
MAYA: He said the last ferry. He never said which harbour.
A photographer turns, lens raised. JONAH (34) lowers the camera slowly.
JONAH: You weren't supposed to find me here.

INT. FERRY CABIN — NIGHT
Rain on the windows. Maya slides the envelope across the table.
MAYA: Open it. Then tell me you didn't know.
Jonah hesitates. The engine shudders. Lights flicker.
JONAH: I knew. I just hoped you'd never ask.

EXT. FERRY DECK — NIGHT
Maya stands at the rail as the city lights fall away. Jonah joins her, silent.
MAYA: Then we finish it. Together.`;

const sampleCast: CastMember[] = [
  {
    id: "cast_maya",
    name: "Maya",
    role: "Lead",
    face: "late 20s, sharp cheekbones, copper-blonde shoulder-length hair, hazel eyes, faint freckles",
    wardrobe: [
      { id: "w_maya_1", name: "Pier look", description: "olive bomber jacket over white tee, dark jeans, silver hoop earrings" },
      { id: "w_maya_2", name: "Night rain", description: "charcoal trench coat, collar up, wet hair, black boots" },
    ],
    activeWardrobe: "w_maya_1",
    voice: { name: "Warm alto", style: "measured, quietly urgent", pitch: 1 },
    styleTags: ["naturalistic", "35mm grain", "warm skin tones"],
    locked: false,
    color: "#8db600",
  },
  {
    id: "cast_jonah",
    name: "Jonah",
    role: "Supporting",
    face: "mid 30s, short dark curls, two-day stubble, tired brown eyes, small scar on left eyebrow",
    wardrobe: [{ id: "w_jonah_1", name: "Photographer", description: "brown suede jacket, grey henley, camera strap across chest" }],
    activeWardrobe: "w_jonah_1",
    voice: { name: "Low baritone", style: "guarded, soft-spoken", pitch: 0.85 },
    styleTags: ["naturalistic", "35mm grain"],
    locked: false,
    color: "#ff4d8d",
  },
];

const sampleVault: VaultRef[] = [
  { id: "ref_pier", kind: "location", name: "Harbour pier", description: "weathered wooden pier, sailboat masts, low sun behind, gulls", tags: ["exterior", "day"], createdAt: Date.now() },
  { id: "ref_cabin", kind: "location", name: "Ferry cabin", description: "cramped steel cabin, rain-streaked portholes, flickering tungsten bulbs", tags: ["interior", "night"], createdAt: Date.now() },
  { id: "ref_envelope", kind: "prop", name: "Sealed envelope", description: "cream envelope with red wax seal, creased corner", tags: ["hero prop"], createdAt: Date.now() },
  { id: "ref_style", kind: "style", name: "Coastal noir", description: "teal shadows, amber highlights, soft halation, 35mm grain", tags: ["grade"], createdAt: Date.now() },
];

/** A fresh canvas: one section with a text note wired into an empty image node. */
const initialNodes: Node[] = [
  { id: "n_sec1", type: "section", position: { x: 0, y: 0 }, zIndex: -1, style: { width: 760, height: 420 }, data: { title: "Scene 1", color: "#3a4650" } },
  { id: "n_note1", type: "text", position: { x: 40, y: 70 }, data: { text: "Describe your first shot here, then press Generate on the image node it's connected to." } },
  { id: "n_img1", type: "media", position: { x: 380, y: 70 }, data: { kind: "image", title: "Shot 1", prompt: "", aspect: "16:9" } },
];

const initialEdges: Edge[] = [{ id: "e_note1", source: "n_note1", target: "n_img1" }];


export interface StudioState {
  // Power Engine
  claudeKeyEnc: string;
  claudeModel: string;
  liveRenders: boolean;
  logs: EngineLog[];
  // Registry
  models: ModelDef[];
  // Cinema Studio
  settings: CinemaSettings;
  prompt: string;
  modelId: string;
  imageModelId: string;
  firstFrame?: string;
  endFrame?: string;
  autoChain: boolean;
  refIds: string[];
  castIds: string[];
  shots: Shot[];
  images: Shot[];
  // Vault + cast
  vault: VaultRef[];
  cast: CastMember[];
  // Drama
  episodes: Episode[];
  activeEpisode: string;
  // Canvas
  nodes: Node[];
  edges: Edge[];
  canvasPrefs: { lines: "all" | "selected" | "off"; minimap: boolean; playOnHover: boolean; assistantOpen: boolean };
  canvasChat: { role: "user" | "assistant"; text: string }[];
  // Timeline
  clips: Clip[];
  burnSubtitles: boolean;
  timelineOpen: boolean;
  // Platform bridge & wallet
  platforms: Platform[];
  ledger: LedgerEntry[];
  routeMode: RouteMode;
  lockPlatform: string;
  bridgeUrl: string;
  bridgeTokenEnc: string;
  // misc
  cookieChoice: "" | "accepted" | "dismissed" | "custom";
  set: (p: Partial<StudioState>) => void;
  update: <K extends keyof StudioState>(key: K, fn: (v: StudioState[K]) => StudioState[K]) => void;
  log: (l: Omit<EngineLog, "id" | "at">) => void;
  reset: () => void;
}


const initial = () => ({
  claudeKeyEnc: "",
  claudeModel: "claude-sonnet-5-5",
  liveRenders: false,
  logs: [] as EngineLog[],
  models: PRESET_MODELS,
  settings: DEFAULT_SETTINGS,
  prompt: "",
  modelId: "seedance-2-5",
  imageModelId: "nano-banana-pro",
  firstFrame: undefined,
  endFrame: undefined,
  autoChain: true,
  refIds: [] as string[],
  castIds: [],
  shots: [] as Shot[],
  images: [] as Shot[],
  vault: sampleVault,
  cast: sampleCast,
  episodes: [] as Episode[],
  activeEpisode: "",
  nodes: initialNodes,
  edges: initialEdges,
  canvasPrefs: { lines: "all", minimap: true, playOnHover: true, assistantOpen: true } as StudioState["canvasPrefs"],
  canvasChat: [] as StudioState["canvasChat"],
  clips: [] as Clip[],
  burnSubtitles: true,
  timelineOpen: true,
  platforms: PRESET_PLATFORMS,
  ledger: [] as LedgerEntry[],
  routeMode: "cheapest" as RouteMode,
  lockPlatform: "",
  bridgeUrl: "http://127.0.0.1:4317",
  bridgeTokenEnc: "",
  cookieChoice: "" as StudioState["cookieChoice"],
});

export const useStudio = create<StudioState>()(
  persist(
    (set, get) => ({
      ...initial(),
      set: (p) => set(p),
      update: (key, fn) => set({ [key]: fn(get()[key]) } as Partial<StudioState>),
      log: (l) => set({ logs: [{ ...l, id: uid("log"), at: Date.now() }, ...get().logs].slice(0, 40) }),
      reset: () => set(initial()),
    }),
    {
      name: "film-studio-companion",
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted || {}) as Partial<StudioState>;
        // keep newly shipped preset models even if an older registry is stored
        const stored = p.models || [];
        const ids = new Set(stored.map((m) => m.id));
        const models = [...stored, ...PRESET_MODELS.filter((m) => !ids.has(m.id))];
        const sp = p.platforms || [];
        const pids = new Set(sp.map((x) => x.id));
        const platforms = sp.length ? [...sp, ...PRESET_PLATFORMS.filter((x) => !pids.has(x.id))] : current.platforms;
        return { ...current, ...p, models: stored.length ? models : current.models, platforms };
      },
    },
  ),
);

export function modelById(models: ModelDef[], id: string) {
  return models.find((m) => m.id === id) || models[0];
}
