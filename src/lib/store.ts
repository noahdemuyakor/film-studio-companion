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
    locked: true,
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
    locked: true,
    color: "#ff4d8d",
  },
];

const sampleVault: VaultRef[] = [
  { id: "ref_pier", kind: "location", name: "Harbour pier", description: "weathered wooden pier, sailboat masts, low sun behind, gulls", tags: ["exterior", "day"], createdAt: Date.now() },
  { id: "ref_cabin", kind: "location", name: "Ferry cabin", description: "cramped steel cabin, rain-streaked portholes, flickering tungsten bulbs", tags: ["interior", "night"], createdAt: Date.now() },
  { id: "ref_envelope", kind: "prop", name: "Sealed envelope", description: "cream envelope with red wax seal, creased corner", tags: ["hero prop"], createdAt: Date.now() },
  { id: "ref_style", kind: "style", name: "Coastal noir", description: "teal shadows, amber highlights, soft halation, 35mm grain", tags: ["grade"], createdAt: Date.now() },
];

const initialNodes: Node[] = [
  { id: "n_script", type: "script", position: { x: 0, y: 40 }, data: { text: SAMPLE_SCRIPT.split("\n").slice(0, 6).join("\n") } },
  { id: "n_maya", type: "character", position: { x: 380, y: -40 }, data: { castId: "cast_maya" } },
  { id: "n_pier", type: "location", position: { x: 380, y: 230 }, data: { refId: "ref_pier", lighting: "Golden Hour" } },
  { id: "n_shot1", type: "shot", position: { x: 760, y: 40 }, data: { title: "Shot 1 — Maya on the pier", prompt: "Maya walks the pier holding the envelope, scanning the boats", modelId: "kling-3-0" } },
  { id: "n_shot2", type: "shot", position: { x: 1160, y: 40 }, data: { title: "Shot 2 — Jonah lowers camera", prompt: "Jonah lowers his camera slowly as Maya approaches", modelId: "kling-3-0" } },
  { id: "n_compare", type: "compare", position: { x: 760, y: 520 }, data: { prompt: "Wide establishing shot of the harbour at golden hour", modelIds: ["omni-flash", "wan-2-7", "veo-3-1"] } },
];

const initialEdges: Edge[] = [
  { id: "e1", source: "n_maya", target: "n_shot1", animated: true },
  { id: "e2", source: "n_pier", target: "n_shot1", animated: true },
  { id: "e3", source: "n_shot1", target: "n_shot2", animated: true, label: "last frame → first frame" },
  { id: "e4", source: "n_pier", target: "n_compare", animated: true },
];

const initialClips: Clip[] = [
  { id: "c1", track: "video", start: 0, duration: 5, label: "Pier — Maya walks", seed: 11, transition: "cut", subtitle: "He said the last ferry." },
  { id: "c2", track: "video", start: 5, duration: 4, label: "Jonah lowers camera", seed: 23, transition: "dissolve", subtitle: "You weren't supposed to find me here." },
  { id: "c3", track: "dialogue", start: 0.6, duration: 3, label: "MAYA: He said the last ferry…", seed: 3, transition: "cut" },
  { id: "c4", track: "dialogue", start: 5.8, duration: 2.6, label: "JONAH: You weren't supposed…", seed: 4, transition: "cut" },
  { id: "c5", track: "sfx", start: 0, duration: 9, label: "Gulls + wind", seed: 5, transition: "fade" },
  { id: "c6", track: "music", start: 2, duration: 7, label: "Low strings", seed: 6, transition: "fade" },
];

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

const firstEpisode: Episode = { id: "ep_1", title: "Episode 1 — The Last Ferry", logline: "", script: SAMPLE_SCRIPT, scenes: [], updatedAt: Date.now() };

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
  castIds: ["cast_maya"],
  shots: [] as Shot[],
  images: [] as Shot[],
  vault: sampleVault,
  cast: sampleCast,
  episodes: [firstEpisode],
  activeEpisode: firstEpisode.id,
  nodes: initialNodes,
  edges: initialEdges,
  clips: initialClips,
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
