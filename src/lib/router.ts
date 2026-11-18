"use client";
/** Modular provider router: maps app controls onto each model's payload and dispatches the call. */
import { nearest } from "./adapters";
import type { CastMember, CinemaSettings, ModelDef, RouteMode, RoutePlan, Shot, VaultRef } from "./types";
import { executeOnPlatform, planRoute } from "./bridge";
import { decryptSecret } from "./secure";
import { getPath, hash, setPath, uid } from "./util";
import { compilePrompt, continuity } from "./engine";
import { useStudio } from "./store";

export type Controls = Partial<Record<string, unknown>>;

export function buildPayload(model: ModelDef, controls: Controls) {
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(model.staticParams || "{}");
  } catch {
    body = {};
  }
  Object.entries(model.paramMap).forEach(([app, key]) => {
    const v = controls[app];
    if (key && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length)) setPath(body, key, v);
  });
  return model.provider === "replicate" ? { input: body } : body;
}

export function estimateCost(model: ModelDef, duration = 5) {
  return Math.round(model.cost + (model.kind === "video" ? model.costPerSecond * duration : 0));
}

function authHeaders(model: ModelDef, key: string): Record<string, string> {
  if (!key) return {};
  if (model.provider === "fal") return { Authorization: `Key ${key}` };
  return { Authorization: `Bearer ${key}` };
}

export async function dispatch(model: ModelDef, payload: unknown): Promise<{ url?: string; simulated: boolean; raw?: unknown }> {
  const { liveRenders } = useStudio.getState();
  const key = await decryptSecret(model.apiKeyEnc);
  const canCall = liveRenders && model.endpoint && (key || model.provider === "webhook") && !model.endpoint.includes("PROJECT") && !model.endpoint.includes("example");
  if (!canCall) {
    // Preview render: no network, deterministic placeholder so the workflow stays testable.
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 900));
    return { simulated: true };
  }
  const res = await fetch(model.endpoint, {
    method: model.method,
    headers: { "content-type": "application/json", ...authHeaders(model, key) },
    body: model.method === "POST" ? JSON.stringify(payload) : undefined,
  });
  if (!res.ok) throw new Error(`${model.name} returned ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const json = await res.json();
  const url = getPath(json, model.responsePath);
  return { url: typeof url === "string" ? url : undefined, simulated: false, raw: json };
}

export interface ProduceInput {
  title: string;
  prompt: string;
  model: ModelDef;
  settings: CinemaSettings;
  cast: CastMember[];
  refs: VaultRef[];
  prev?: Shot;
  firstFrameUrl?: string;
  lastFrameUrl?: string;
  extendBack?: number;
  extendForward?: number;
  routeMode?: RouteMode;
  lockId?: string;
  plan?: RoutePlan;
  onLine?: (l: string) => void;
}

/** Full pipeline: Continuity Guardian → Optical Prompt Compiler → payload mapping → provider dispatch. */
export async function produceShot(input: ProduceInput, onStage?: (s: Shot["status"], partial?: Partial<Shot>) => void): Promise<Shot> {
  const { model, settings } = input;
  onStage?.("compiling");
  const cont = await continuity(input.cast, input.refs, settings, input.prev);
  const compiled = await compilePrompt(input.prompt, settings, model, cont.value);
  onStage?.("rendering", { compiled: compiled.value, continuity: cont.value });
  const asked = Math.min(30, settings.duration + (input.extendBack || 0) + (input.extendForward || 0));
  // keep the clip to a length the model really accepts (some go to 30 s, some only 8)
  const duration = model.kind !== "video" ? asked : model.durations?.length ? nearest(asked, model.durations) : Math.min(asked, model.maxDuration || asked);
  const seed = hash(input.prompt + Date.now()) % 100000;
  const negative = compiled.value.includes("Negative prompt:") ? compiled.value.split("Negative prompt:")[1].trim() : undefined;
  const payload = buildPayload(model, {
    prompt: compiled.value.split("\nNegative prompt:")[0],
    negative_prompt: negative,
    aspect_ratio: settings.aspect,
    duration: Math.min(duration, model.maxDuration || duration),
    resolution: settings.resolution,
    seed,
    audio: settings.audio,
    reference_urls: input.refs.filter((r) => r.dataUrl).map((r) => r.dataUrl),
    first_frame_url: input.firstFrameUrl,
    last_frame_url: input.lastFrameUrl,
  });
  const base: Shot = {
    id: uid("shot"),
    title: input.title,
    prompt: input.prompt,
    compiled: compiled.value,
    continuity: cont.value,
    modelId: model.id,
    settings,
    refIds: input.refs.map((r) => r.id),
    castIds: input.cast.map((c) => c.id),
    firstFrame: input.prev?.id,
    extendBack: input.extendBack || 0,
    extendForward: input.extendForward || 0,
    status: "rendering",
    seed,
    credits: estimateCost(model, duration),
    payload,
    createdAt: Date.now(),
    engine: compiled.mode,
  };
  try {
    const st = useStudio.getState();
    const plan = input.plan || (await planRoute(model, input.routeMode || st.routeMode, input.lockId ?? st.lockPlatform, duration));
    if (plan.blocked) return { ...base, credits: 0, route: plan.reason, status: "error", error: plan.blocked };
    const pf = plan.platformId ? useStudio.getState().platforms.find((x) => x.id === plan.platformId) : undefined;
    const controls = { prompt: compiled.value, aspect_ratio: settings.aspect, duration, seed, resolution: settings.resolution };
    const r = pf ? await executeOnPlatform(pf, model, controls, payload, plan.cost, input.onLine) : await dispatch(model, payload);
    return { ...base, credits: plan.cost, platformId: plan.platformId, route: plan.reason, status: "done", resultUrl: r.url, simulated: r.simulated };
  } catch (e) {
    return { ...base, status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}
