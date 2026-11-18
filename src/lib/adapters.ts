"use client";
/**
 * Platform adapters: real image and video renders on the platforms you connect, paid from their credits.
 *  - catalog: every image/video model a platform offers, merged into the studio's model list
 *  - render:  submit -> wait -> return the finished file's URL, with each platform's own inputs
 * Supported: Flick, OpenArt, ImagineArt (remote MCP via the bridge) and Google Flow (local MCP).
 */
import { useStudio } from "./store";
import { bridgeHeaders, mcpRpc, textOf } from "./bridge";
import type { MediaInput, ModelDef, ModelKind, Platform } from "./types";

export type AdapterId = NonNullable<Platform["adapter"]>;

export function detectAdapter(pf: Pick<Platform, "tools"> & Partial<Pick<Platform, "mode" | "command">>): AdapterId | undefined {
  if (pf.mode === "cli" && /pixmax/i.test(pf.command || "")) return "pixmax";
  const n = new Set(pf.tools.map((t) => t.name));
  if (n.has("openart_generate_image")) return "openart";
  if (n.has("flow_generate")) return "flow";
  if (n.has("generate_image") && n.has("wait_for_jobs") && n.has("download_media")) return "flick";
  if (n.has("generate_image") && n.has("fetch_status") && n.has("select_organization")) return "imagineart";
  return undefined;
}

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function parse<T = Record<string, unknown>>(t: string): T | null {
  try {
    return JSON.parse(t) as T;
  } catch {
    const m = t.match(/\{[\s\S]*\}/);
    try {
      return m ? (JSON.parse(m[0]) as T) : null;
    } catch {
      return null;
    }
  }
}

/** tools/call that throws the tool's own message when it reports an error */
async function call(pf: Platform, name: string, args: Record<string, unknown>): Promise<string> {
  const r = (await mcpRpc(pf, "tools/call", { name, arguments: args })) as { isError?: boolean } | null;
  const text = textOf(r);
  if (r?.isError) throw new Error(`${pf.name}: ${text.slice(0, 300) || `${name} failed`}`);
  return text;
}

/* ------------------------------------------------------------------ */
/* Catalog: every model a platform offers                              */
/* ------------------------------------------------------------------ */

export interface CatalogEntry {
  native: string;
  name: string;
  kind: ModelKind;
  credits: number; // per image, or per ~5 s of video
  mode?: string;
  durations?: number[]; // video clip lengths this platform accepts for the model
  resolutions?: string[]; // output resolutions, in the platform's own spelling
}

/** "1080P" / "1080p" -> "1080p"; "2k" -> "2K": one spelling for comparing and showing */
export const normRes = (r: string) => {
  const s = String(r).trim();
  return /^\d+p$/i.test(s) ? s.toLowerCase() : /^\d+k$/i.test(s) ? s.toUpperCase() : s;
};
const resHeight = (r: string) => {
  const s = normRes(r);
  const p = s.match(/^(\d+)p$/);
  if (p) return Number(p[1]);
  const k = s.match(/^(\d+)K$/);
  return k ? ({ 1: 1024, 2: 1440, 4: 2160, 8: 4320 } as Record<string, number>)[k[1]] || Number(k[1]) * 540 : 0;
};
const isRes = (r: string) => resHeight(r) > 0;
const uniqRes = (a: string[]) => [...new Set(a.map(normRes).filter(isRes))].sort((x, y) => resHeight(x) - resHeight(y));
/** the platform's own spelling of the resolution closest to the one asked for */
export function pickRes(want: string | undefined, allowed?: string[]): string | undefined {
  if (!want || !allowed?.length) return undefined;
  const ok = allowed.filter(isRes);
  if (!ok.length) return undefined;
  const exact = ok.find((r) => normRes(r) === normRes(want));
  return exact || ok.reduce((a, b) => (Math.abs(resHeight(b) - resHeight(want)) < Math.abs(resHeight(a) - resHeight(want)) ? b : a));
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, k) => a + k);
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n) && n > 0) : []);
const uniq = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
/** "kling-4.0: 3 through 30 (any whole second)" / "veo-3.1, veo-3.1-fast: 4, 6, 8" lines from a tool description */
function durationTable(desc: string): Record<string, number[]> {
  const sec = desc.split(/duration \(optional\)/i)[1]?.split(/•\s*resolution/i)[0] || "";
  const out: Record<string, number[]> = {};
  sec.split("\n").forEach((line) => {
    const m = line.match(/^\s*-\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    const thr = m[2].match(/(\d+)\s*through\s*(\d+)/i);
    const list = thr ? range(Number(thr[1]), Number(thr[2])) : (m[2].match(/\d+/g) || []).map(Number);
    if (list.length) m[1].split(",").forEach((id) => (out[id.trim()] = list));
  });
  return out;
}
/** "kling-4.0, pika-2.2: 720p, 1080p" lines under a tool description's resolution rules */
function resolutionTable(desc: string): Record<string, string[]> {
  const sec = desc.split(/resolution \(optional\)/i)[1]?.split(/\n\s*•/)[0] || "";
  const out: Record<string, string[]> = {};
  sec.split("\n").forEach((line) => {
    const m = line.match(/^\s*-\s*([^:]+):\s*(.+)$/);
    if (!m) return;
    const list = (m[2].match(/\b\d+[pPkK]\b/g) || []).map(normRes);
    if (list.length) m[1].split(",").forEach((id) => (out[id.trim()] = list));
  });
  return out;
}

/** the length closest to what was asked for, among those allowed */
export const nearest = (want: number, allowed?: number[]) => (allowed?.length ? allowed.reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a)) : want);

/** "8-28 credits" -> 8; "31-47/s" -> 31*5 (5 s clip) */
function creditsFrom(v: unknown, kind: ModelKind): number {
  const s = String(v ?? "");
  const n = Number((s.match(/\d+(\.\d+)?/) || ["0"])[0]);
  return /\/\s*s\b/.test(s) && kind === "video" ? Math.round(n * 5) : Math.round(n);
}

const FLOW_MODELS: CatalogEntry[] = [
  { native: "Nano Banana 2.1", name: "Nano Banana 2.1", kind: "image", credits: 0 },
  { native: "Nano Banana Pro", name: "Nano Banana Pro", kind: "image", credits: 0 },
  { native: "Omni 1.1 Flash", name: "Omni 1.1 Flash", kind: "video", credits: 7, durations: [4, 6, 8, 10], resolutions: ["360p", "720p"] },
  { native: "Veo 3.1 - Lite", name: "Veo 3.1 Lite", kind: "video", credits: 10, durations: [8] },
  { native: "Veo 3.1 - Fast", name: "Veo 3.1 Fast", kind: "video", credits: 20, durations: [8] },
  { native: "Veo 3.1 - Quality", name: "Veo 3.1", kind: "video", credits: 100, durations: [8] },
];

export async function catalog(pf: Platform, adapter: AdapterId): Promise<CatalogEntry[]> {
  if (adapter === "flow") return FLOW_MODELS;
  if (adapter === "flick") {
    const out: CatalogEntry[] = [];
    for (const kind of ["image", "video"] as const) {
      const j = parse<{ models?: { id: string; name: string; credits?: string; settings?: { duration?: unknown; resolution?: unknown } }[] }>(await call(pf, "list_models", { kind }));
      (j?.models || [])
        .filter((m) => m.id !== "auto")
        .forEach((m) => out.push({ native: m.id, name: m.name, kind, credits: creditsFrom(m.credits, kind), durations: kind === "video" ? uniq(nums(m.settings?.duration)) : undefined, resolutions: Array.isArray(m.settings?.resolution) ? (m.settings!.resolution as string[]).map(String) : undefined }));
    }
    return out;
  }
  if (adapter === "openart") {
    type Mode = { mode: string; totalCredits?: number };
    const j = parse<{ models?: { id: string; displayName: string; modes?: { image?: Mode[]; video?: Mode[] } }[] }>(await call(pf, "openart_model_list", {}));
    const out: CatalogEntry[] = [];
    (j?.models || []).forEach((m) => {
      const img = m.modes?.image?.find((x) => x.mode === "text2image");
      const vid = m.modes?.video?.find((x) => x.mode === "text2video");
      if (img) out.push({ native: m.id, name: m.displayName, kind: "image", credits: Math.round(img.totalCredits || 0), mode: img.mode });
      if (vid) out.push({ native: m.id, name: m.displayName, kind: "video", credits: Math.round(vid.totalCredits || 0), mode: vid.mode });
    });
    // each video model's form lists the lengths it accepts (a few at a time, to stay polite to the server)
    const vids = out;
    for (let i = 0; i < vids.length; i += 4)
      await Promise.all(
        vids.slice(i, i + 4).map(async (e) => {
          try {
            const f = parse<{ jsonSchema?: { properties?: Record<string, { enum?: unknown[]; minimum?: number; maximum?: number }> } }>(await call(pf, "openart_model_form_get", { model: e.native, mode: e.mode }));
            const props = f?.jsonSchema?.properties || {};
            const rk = Object.keys(props).find((x) => /^resolution$/i.test(x)) || Object.keys(props).find((x) => /resolution/i.test(x));
            if (rk && props[rk].enum) e.resolutions = props[rk].enum!.map(String).filter(isRes);
            const k = Object.keys(props).find((x) => /duration/i.test(x));
            if (!k || e.kind !== "video") return;
            const d = props[k];
            e.durations = uniq(d.enum ? nums(d.enum) : d.minimum && d.maximum ? range(Math.ceil(d.minimum), Math.floor(d.maximum)) : []);
          } catch {
            /* keep going without this model's lengths */
          }
        }),
      );
    return out;
  }
  if (adapter === "pixmax") return pixmaxCatalog();
  // ImagineArt lists its models inside the generate tools' descriptions; it publishes no prices, so estimates are used
  const out: CatalogEntry[] = [];
  const lengths = durationTable(pf.tools.find((t) => t.name === "generate_video")?.description || "");
  const vres = resolutionTable(pf.tools.find((t) => t.name === "generate_video")?.description || "");
  const ires = resolutionTable(pf.tools.find((t) => t.name === "generate_image")?.description || "");
  for (const [tool, kind, est] of [["generate_image", "image", 10], ["generate_video", "video", 60]] as const) {
    const d = pf.tools.find((t) => t.name === tool)?.description || "";
    const list = d.match(/model \(optional\)[^\n]*?one of:([\s\S]*?)\.\s*\n/i)?.[1] || d.match(/model[^\n]*one of:([\s\S]*?)\n/i)?.[1] || "";
    [...list.matchAll(/"([a-zA-Z0-9.\-_]+)"/g)].forEach(([, id]) => {
      if (/edit$|kontext/.test(id)) return; // edit-only models need a source image
      out.push({ native: id, name: id.replace(/-/g, " ").replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/V(\d)/g, "v$1"), kind, credits: est, durations: kind === "video" ? lengths[id] : undefined, resolutions: (kind === "video" ? vres : ires)[id] });
    });
  }
  return out;
}

function platformModel(id: string, e: CatalogEntry, pf: Platform): ModelDef {
  return {
    id,
    name: e.name,
    vendor: e.name.split(/\s+/)[0],
    kind: e.kind,
    provider: "rest",
    endpoint: "",
    method: "POST",
    capabilities: e.kind === "image" ? ["t2i"] : ["t2v", "i2v"],
    paramMap: {},
    staticParams: "{}",
    responsePath: "",
    cost: e.credits,
    costPerSecond: 0,
    tier: "final",
    promptStyle: "prose",
    maxDuration: e.kind === "video" ? Math.max(...(e.durations?.length ? e.durations : [10])) : 0,
    durations: e.kind === "video" && e.durations?.length ? e.durations : undefined,
    resolutions: e.resolutions?.length ? uniqRes(e.resolutions) : undefined,
    enabled: true,
    builtin: false,
    blurb: `Offered by ${pf.name}`,
    notes: "platform",
  };
}

/** Pulls the platform's models into the studio's list and records its real prices. Returns how many it offers. */
export async function syncCatalog(pf: Platform): Promise<number> {
  const adapter = detectAdapter(pf);
  if (!adapter) return 0;
  const entries = await catalog(pf, adapter);
  const st = useStudio.getState();
  const models = [...st.models];
  const prices: Record<string, number> = {};
  const native: NonNullable<Platform["nativeModels"]> = {};
  entries.forEach((e) => {
    const key = slug(e.name);
    let m = models.find((x) => x.kind === e.kind && (x.id === key || slug(x.name) === key));
    if (!m) {
      m = platformModel(models.some((x) => x.id === key) ? `${key}-${e.kind}` : key, e, pf);
      models.push(m);
    } else if (!m.builtin && m.notes === "platform" && !m.blurb.includes(pf.name)) {
      m = { ...m, blurb: `${m.blurb}, ${pf.name}` };
      models[models.findIndex((x) => x.id === m!.id)] = m;
    }
    // a model's lengths are everything any of its platforms accepts; each platform still gets one it allows
    if (e.kind === "video" && e.durations?.length) {
      const all = uniq([...(m.durations || []), ...e.durations]);
      m = { ...m, durations: all, maxDuration: Math.max(...all) };
      models[models.findIndex((x) => x.id === m!.id)] = m;
    }
    if (e.resolutions?.length) {
      const all = uniqRes([...(m.resolutions || []), ...e.resolutions]);
      m = { ...m, resolutions: all };
      models[models.findIndex((x) => x.id === m!.id)] = m;
    }
    prices[m.id] = e.credits;
    native[m.id] = { id: e.native, mode: e.mode, kind: e.kind, durations: e.durations, resolutions: e.resolutions };
  });
  st.set({ models });
  st.update("platforms", (v) => v.map((q) => (q.id === pf.id ? { ...q, adapter, models: prices, nativeModels: native } : q)));
  return entries.length;
}

/* ------------------------------------------------------------------ */
/* Setup: Flick project, ImagineArt organization                       */
/* ------------------------------------------------------------------ */

export async function flickProjects(pf: Platform): Promise<{ id: string; name: string }[]> {
  const j = parse<{ projects?: { project_id: string; name: string }[] }>(await call(pf, "list_projects", { limit: 50 }));
  return (j?.projects || []).map((p) => ({ id: p.project_id, name: p.name }));
}

export async function flickCreateProject(pf: Platform, name: string): Promise<{ id: string; name: string }> {
  const j = parse<{ project_id: string; name: string }>(await call(pf, "create_project", { name }));
  if (!j?.project_id) throw new Error("Flick didn't return the new project");
  return { id: j.project_id, name: j.name };
}

async function imagineOrg(pf: Platform): Promise<string> {
  if (pf.adapterConfig?.orgId) return pf.adapterConfig.orgId;
  const t = await call(pf, "select_organization", {});
  const ids = [...t.matchAll(/org_id:\s*([0-9a-f-]{36})/gi)].map((m) => m[1]);
  if (ids.length !== 1) throw new Error(ids.length ? "Pick your ImagineArt organization in Settings first." : "ImagineArt returned no organization.");
  useStudio.getState().update("platforms", (v) => v.map((q) => (q.id === pf.id ? { ...q, adapterConfig: { ...q.adapterConfig, orgId: ids[0] } } : q)));
  return ids[0];
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

export interface RenderRequest {
  modelId: string;
  kind: ModelKind;
  prompt: string;
  aspect: string;
  duration: number;
  resolution?: string;
  maxCredits: number; // refuse anything quoted above this
  media?: MediaInput[]; // first frame and reference images wired into the render
}

export interface RenderResult {
  url: string;
  nativeId?: string; // the platform's own id for the result (Flick job id)
}

type Line = (l: string) => void;

export async function renderOn(pf: Platform, req: RenderRequest, onLine: Line = () => {}): Promise<RenderResult> {
  const adapter = pf.adapter || detectAdapter(pf);
  const nat = pf.nativeModels?.[req.modelId];
  if (!adapter) throw new Error(`${pf.name} has no render adapter`);
  if (!nat) throw new Error(`${pf.name} doesn't offer this model — reconnect it in Settings to refresh its model list.`);
  if (req.kind === "video" && nat.durations?.length) req = { ...req, duration: nearest(req.duration || 5, nat.durations) };
  // the platform's own spelling of the nearest resolution it offers; none listed -> let the platform use its default
  req = { ...req, resolution: pickRes(req.resolution, nat.resolutions) };
  if (adapter === "flick") return flick(pf, nat.id, req, onLine);
  const url =
    adapter === "pixmax"
      ? await pixmax(pf, nat.id, req, onLine)
      : adapter === "openart"
        ? await openart(pf, nat.id, nat.mode || (req.kind === "image" ? "text2image" : "text2video"), req, onLine)
        : adapter === "imagineart"
          ? await imagine(pf, nat.id, req, onLine)
          : await flow(pf, nat.id, req, onLine);
  return { url };
}

/* --- Flick: jobs on a project board; video animates a first frame --- */
async function flick(pf: Platform, model: string, req: RenderRequest, onLine: Line): Promise<RenderResult> {
  const project_id = pf.adapterConfig?.projectId;
  if (!project_id) throw new Error("Choose a Flick project for renders in Settings → Flick.");
  const board_name = "Film Studio Companion";
  const wait = async (job: string, what: string) => {
    for (let i = 0; i < 40; i++) {
      const j = parse<{ jobs?: { status: string; error?: string; reason?: string }[] }>(await call(pf, "wait_for_jobs", { job_ids: [job], timeout_seconds: 50 }));
      const s = j?.jobs?.[0];
      if (s?.status === "succeeded") return;
      if (s && /fail|error|cancel/i.test(s.status)) throw new Error(`Flick ${what} failed${s.error || s.reason ? `: ${s.error || s.reason}` : ""}`);
      onLine(`Flick is rendering the ${what}…`);
    }
    throw new Error(`Flick ${what} is still rendering — it will appear on the "${board_name}" board in Flick.`);
  };
  const start = async (tool: string, args: Record<string, unknown>) => {
    const j = parse<{ jobs?: { job_id: string }[]; job_id?: string }>(await call(pf, tool, { project_id, board_name, ...args }));
    const id = j?.jobs?.[0]?.job_id || j?.job_id;
    if (!id) throw new Error("Flick didn't start the job");
    return id;
  };
  // images made on Flick can be passed by their job id; images from elsewhere can't be uploaded through Flick's tools
  const onFlick = (m: MediaInput) => (m.native?.platformId === pf.id ? m.native.id : undefined);
  const refs = (req.media || []).filter((m) => m.role === "ref").map(onFlick).filter(Boolean) as string[];
  const first = (req.media || []).filter((m) => m.role === "first").map(onFlick).find(Boolean);
  let job: string;
  if (req.kind === "image") {
    onLine(`Flick: ${model}`);
    job = await start("generate_image", { prompt: req.prompt, model, aspect_ratio: req.aspect, max_credits: req.maxCredits, ...(req.resolution ? { settings: { resolution: req.resolution } } : {}), ...(refs.length ? { reference_media_ids: refs.slice(0, 10) } : {}) });
    await wait(job, "image");
  } else {
    // Flick animates an image: the wired first frame if it was made on Flick, else a 1-credit frame from the prompt
    let frame = first;
    if (!frame) {
      onLine("Flick: first frame (gpt-image-2, 1 cr)…");
      frame = await start("generate_image", { prompt: req.prompt, model: "gpt-image-2", settings: { quality: "low", resolution: "1K" }, aspect_ratio: req.aspect, max_credits: 3, ...(refs.length ? { reference_media_ids: refs.slice(0, 10) } : {}) });
      await wait(frame, "first frame");
    } else onLine("Flick: animating your frame…");
    onLine(`Flick: ${model} video…`);
    job = await start("generate_video", { prompt: req.prompt, start_frame_media_id: frame, model, duration: String(Math.round(req.duration || 5)), aspect_ratio: req.aspect, max_credits: req.maxCredits, ...(req.resolution ? { settings: { resolution: req.resolution } } : {}) });
    await wait(job, "video");
  }
  const d = parse<{ media?: { url: string }[] }>(await call(pf, "download_media", { project_id, media_ids: [job] }));
  const url = d?.media?.[0]?.url;
  if (!url) throw new Error("Flick finished but returned no file link");
  return { url, nativeId: job };
}

/* --- OpenArt: form-driven params, poll by historyId --- */
const forms: Record<string, Record<string, { enum?: unknown[]; type?: string; minimum?: number; maximum?: number }>> = {};
async function openart(pf: Platform, model: string, mode: string, req: RenderRequest, onLine: Line): Promise<string> {
  const key = `${model}|${mode}`;
  if (!forms[key]) {
    const f = parse<{ jsonSchema?: { properties?: (typeof forms)[string] } }>(await call(pf, "openart_model_form_get", { model, mode }));
    forms[key] = f?.jsonSchema?.properties || {};
  }
  const props = forms[key];
  const params: Record<string, unknown> = { prompt: req.prompt };
  const pick = (re: RegExp) => Object.keys(props).find((k) => re.test(k));
  const ar = pick(/aspect/i);
  if (ar && (!props[ar].enum || props[ar].enum!.includes(req.aspect))) params[ar] = req.aspect;
  const dur = pick(/duration/i);
  if (dur && req.kind === "video") {
    const opts = props[dur].enum as (string | number)[] | undefined;
    const want = Math.round(req.duration || 5);
    const best = opts?.length ? opts.reduce((a, b) => (Math.abs(Number(b) - want) < Math.abs(Number(a) - want) ? b : a)) : want;
    params[dur] = props[dur].type === "string" ? String(best) : Number(best);
  }
  const res = pick(/^resolution$/i) || pick(/resolution/i);
  if (res && req.resolution) {
    const hit = props[res].enum?.find((x) => normRes(String(x)) === normRes(req.resolution!));
    if (hit !== undefined || !props[res].enum) params[res] = hit ?? req.resolution;
  }
  const q = parse<{ items?: { totalCredits: number }[]; totalCredits?: number }>(await call(pf, "openart_model_cost", { model, mode, params }));
  const price = q?.items?.[0]?.totalCredits ?? q?.totalCredits;
  if (typeof price === "number" && price > req.maxCredits) throw new Error(`OpenArt quotes ${price} credits for this, above the ${req.maxCredits} cap — nothing was spent.`);
  onLine(`OpenArt: ${model}${typeof price === "number" ? ` (${price} cr)` : ""}`);
  const g = parse<{ historyId?: string }>(await call(pf, req.kind === "image" ? "openart_generate_image" : "openart_generate_video", { model, mode, params }));
  if (!g?.historyId) throw new Error("OpenArt didn't start the job");
  for (let i = 0; i < 240; i++) {
    const s = parse<{ status?: string; pollAfterSeconds?: number; resources?: { url?: string }[]; error?: string; message?: string }>(await call(pf, "openart_creation_get", { historyId: g.historyId }));
    if (s?.status === "COMPLETED") {
      const url = s.resources?.find((r) => r.url)?.url;
      if (!url) throw new Error("OpenArt finished but returned no file link");
      return url;
    }
    if (s?.status === "FAILED" || s?.status === "CANCELLED") throw new Error(`OpenArt ${s.status.toLowerCase()}${s.error || s.message ? `: ${s.error || s.message}` : ""}`);
    onLine(`OpenArt is rendering (${s?.status?.toLowerCase() || "queued"})…`);
    await sleep(Math.min(15, Math.max(4, s?.pollAfterSeconds || 5)) * 1000);
  }
  throw new Error("OpenArt is still rendering — it will appear in your OpenArt project.");
}

/* --- ImagineArt: uuid + fetch_status(sync) --- */
async function imagine(pf: Platform, model: string, req: RenderRequest, onLine: Line): Promise<string> {
  const org_id = await imagineOrg(pf);
  onLine(`ImagineArt: ${model}`);
  const web = (req.media || []).filter((m) => m.url && /^https?:/.test(m.url));
  const image_url = (req.kind === "video" ? [...web.filter((m) => m.role === "first"), ...web.filter((m) => m.role === "ref")] : web).map((m) => m.url!).slice(0, 4);
  const t =
    req.kind === "image"
      ? await call(pf, "generate_image", { prompt: req.prompt, org_id, model, aspect_ratio: req.aspect, ...(req.resolution ? { resolution: req.resolution } : {}), ...(image_url.length ? { image_url } : {}) })
      : await call(pf, "generate_video", { prompt: req.prompt, org_id, model, aspect_ratio: req.aspect, duration: String(Math.round(req.duration || 5)), ...(req.resolution ? { resolution: req.resolution } : {}), ...(image_url.length ? { image_url } : {}) });
  const id = (parse<{ id?: string; uuid?: string }>(t)?.uuid || parse<{ id?: string }>(t)?.id || t.match(UUID)?.[0]) as string | undefined;
  if (!id) throw new Error(`ImagineArt didn't start the job: ${t.slice(0, 200)}`);
  const media = /https?:\/\/[^\s"'<>)]+?\.(png|jpe?g|webp|gif|mp4|mov|webm)(\?[^\s"'<>)]*)?/i;
  for (let i = 0; i < 30; i++) {
    const s = await call(pf, "fetch_status", { id, sync: true, org_id });
    const url = s.match(media)?.[0];
    if (url && !/fail/i.test(parse<{ status?: string }>(s)?.status || "")) return url;
    if (/"status"\s*:\s*"(failed|error|cancel)/i.test(s)) throw new Error(`ImagineArt failed: ${s.slice(0, 200)}`);
    onLine("ImagineArt is rendering…");
  }
  throw new Error("ImagineArt is still rendering — it will appear in your ImagineArt assets.");
}

/* --- Google Flow: local files, handed to the page through the bridge --- */
async function flow(pf: Platform, model: string, req: RenderRequest, onLine: Line): Promise<string> {
  const status = parse<{ flow?: { inProject?: boolean; signedIn?: boolean; hint?: string } }>(await call(pf, "flow_status", { detailed: false }));
  if (status?.flow && (!status.flow.signedIn || !status.flow.inProject)) throw new Error(`Google Flow: ${status.flow.hint || "open a project in the Flow Chrome window first"}`);
  const scene: Record<string, unknown> = { prompt: req.prompt, type: req.kind, model, max_credits: req.maxCredits };
  if (req.kind === "video") {
    scene.aspect_ratio = req.aspect === "9:16" ? "9:16" : "16:9";
    if (/omni/i.test(model)) {
      scene.duration = [4, 6, 8, 10].reduce((a, b) => (Math.abs(b - req.duration) < Math.abs(a - req.duration) ? b : a));
      if (req.resolution) scene.resolution = req.resolution;
    }
  } else if (["16:9", "9:16", "1:1", "4:3", "3:4"].includes(req.aspect)) scene.aspect_ratio = req.aspect;
  onLine(`Google Flow: ${model}`);
  const g = await call(pf, "flow_generate", { project: "FilmStudioCompanion", scenes: [scene] });
  const gj = parse<{ jobs?: { job_id?: string; id?: string }[]; job_ids?: string[]; task_id?: string }>(g);
  const job = gj?.jobs?.[0]?.job_id || gj?.jobs?.[0]?.id || gj?.job_ids?.[0] || gj?.task_id;
  for (let i = 0; i < 60; i++) {
    const w = await call(pf, "flow_wait", job ? { job_ids: [job] } : {});
    const wj = parse<{ finished?: boolean }>(w);
    const paths = [...w.replace(/\\\\/g, "\\").matchAll(/[A-Za-z]:\\[^"\n]+?\.(mp4|mov|webm|png|jpe?g|webp)/gi)].map((m) => m[0]);
    if (paths.length) return shareLocalFile(paths[paths.length - 1]);
    if (wj?.finished) throw new Error(`Google Flow finished without a file: ${w.slice(0, 200)}`);
    if (/"status"\s*:\s*"(failed|error)/i.test(w) && wj?.finished !== false) throw new Error(`Google Flow failed: ${w.slice(0, 200)}`);
    onLine("Google Flow is rendering…");
  }
  throw new Error("Google Flow is still rendering — the file will land in your flow-mcp-out folder.");
}

/** Copies a file Flow saved on this computer into the bridge's served folder and returns its URL. */
async function shareLocalFile(path: string): Promise<string> {
  const st = useStudio.getState();
  const r = await fetch(`${st.bridgeUrl}/media/import`, { method: "POST", headers: { "content-type": "application/json", ...(await bridgeHeaders()) }, body: JSON.stringify({ path }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Bridge couldn't share the file: ${j.error || r.status}`);
  return `${st.bridgeUrl}/files/${encodeURIComponent(j.file)}`;
}

/* ------------------------------------------------------------------ */
/* Pixmax: its CLI, run by the bridge's fixed /pixmax route             */
/* ------------------------------------------------------------------ */

async function pixmaxCall(body: Record<string, unknown>): Promise<unknown> {
  const st = useStudio.getState();
  const r = await fetch(`${st.bridgeUrl}/pixmax`, { method: "POST", headers: { "content-type": "application/json", ...(await bridgeHeaders()) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Pixmax: ${j.error || r.status}`);
  return j.result ?? j.raw;
}

/** Pixmax wraps lists as {data:{data:[...]}}: dig to the array */
function pmRows(j: unknown): Record<string, unknown>[] {
  let d: unknown = (j as { data?: unknown })?.data ?? j;
  while (d && !Array.isArray(d) && typeof d === "object" && "data" in (d as object)) d = (d as { data: unknown }).data;
  if (!Array.isArray(d) && d && typeof d === "object") d = (d as { models?: unknown }).models;
  return Array.isArray(d) ? (d as Record<string, unknown>[]) : [];
}

export async function pixmaxStatus(): Promise<{ loggedIn: boolean; name?: string; tier?: string }> {
  const j = (await pixmaxCall({ action: "status" })) as { loggedIn?: boolean; account?: { name?: string; userTier?: string } };
  return { loggedIn: !!j?.loggedIn, name: j?.account?.name, tier: j?.account?.userTier };
}

async function pixmaxCatalog(): Promise<CatalogEntry[]> {
  const out: CatalogEntry[] = [];
  for (const [type, kind, est] of [["GENERATE_IMAGE", "image", 10], ["GENERATE_VIDEO", "video", 50]] as const) {
    const models = pmRows(await pixmaxCall({ action: "models", type })).filter((m) => m.restricted !== true && m.modelCode);
    for (let i = 0; i < models.length; i += 4)
      await Promise.all(
        models.slice(i, i + 4).map(async (m) => {
          const e: CatalogEntry = { native: String(m.modelCode), name: String(m.modelName || m.modelCode), kind, credits: est };
          try {
            const x = (await pixmaxCall({ action: "explain", type, model: e.native })) as { params?: { name: string; options?: string[] }[] };
            const opt = (n: string) => x?.params?.find((p) => p.name === n)?.options || [];
            if (kind === "video") e.durations = uniq(nums(opt("duration")));
            e.resolutions = opt("resolution").map(String).filter(isRes);
          } catch {
            /* keep the model without its options */
          }
          out.push(e);
        }),
      );
  }
  return out;
}

export async function pixmaxProjects(): Promise<{ id: string; name: string }[]> {
  return pmRows(await pixmaxCall({ action: "projects" })).map((p) => ({ id: String(p.uuid), name: String(p.name || "Untitled") }));
}

/** the first canvas file of a project: that's where Pixmax generation nodes live */
export async function pixmaxCanvas(project: string): Promise<string> {
  const f = pmRows(await pixmaxCall({ action: "files", project }));
  const file = f.find((x) => String(x.fileType || x.type || "").toUpperCase() === "FILE") || f[0];
  if (!file) throw new Error("That Pixmax project has no canvas yet — open it once in Pixmax.");
  return String(file.uuid || file.fileUuid);
}

const pmDefaults: Record<string, Record<string, string>> = {};
/** defaults for the model's settings the studio doesn't control (Pixmax fails a task with any required one missing) */
async function pixmaxExtras(model: string, kind: ModelKind): Promise<Record<string, string>> {
  const key = `${kind}|${model}`;
  if (!pmDefaults[key]) {
    const x = (await pixmaxCall({ action: "explain", type: kind === "image" ? "GENERATE_IMAGE" : "GENERATE_VIDEO", model })) as { params?: { name: string; default?: unknown; options?: unknown[] }[] };
    const skip = new Set(["prompt", "model", "resolution", "aspectRatio", "duration", "count", "referModel", "nodeType"]);
    const out: Record<string, string> = {};
    (x?.params || []).forEach((p) => {
      if (skip.has(p.name)) return;
      const v = p.default ?? p.options?.[0];
      if (v !== undefined && v !== null && String(v) !== "") out[p.name] = String(v);
    });
    pmDefaults[key] = out;
  }
  return pmDefaults[key];
}

async function pixmax(pf: Platform, model: string, req: RenderRequest, onLine: Line): Promise<string> {
  const file = pf.adapterConfig?.projectId;
  if (!file) throw new Error("Choose a Pixmax project for renders in Settings → Pixmax.");
  const extra = await pixmaxExtras(model, req.kind);
  onLine(`Pixmax: ${model} (this waits until the render is done)…`);
  const r = await pixmaxCall({
    action: req.kind,
    prompt: req.prompt,
    file,
    model,
    aspect: req.aspect,
    resolution: req.resolution,
    duration: req.kind === "video" ? String(Math.round(req.duration || 5)) : undefined,
    extra,
  });
  const text = JSON.stringify(r ?? "");
  const fail = text.match(/"(?:status|taskStatus)"\s*:\s*"(FAILED|ABORTED)"/);
  // results: {webUrl:"/static/...", ossDomain:"https://..."} or full URLs
  const urls: string[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const x = o as Record<string, unknown>;
    if (typeof x.webUrl === "string" && /\.(png|jpe?g|webp|gif|mp4|mov|webm)$/i.test(x.webUrl) && !/_(preview|thumbnail)\./.test(x.webUrl))
      urls.push(/^https?:/.test(x.webUrl) ? x.webUrl : `${String(x.ossDomain || "https://console.pixmax.ai")}${x.webUrl}`);
    Object.values(x).forEach(walk);
  };
  walk(r);
  if (!urls.length) urls.push(...(text.match(/https?:\/\/[^"\\\s]+?\.(png|jpe?g|webp|mp4|mov|webm)/gi) || []).filter((u) => !/_(preview|thumbnail)\./.test(u)));
  if (urls.length) return urls[urls.length - 1];
  const msg = (text.match(/providerErrorMsgEh\\*"\s*:\s*\\*"([^"\\]+)/) || text.match(/"(?:errMessage|error|message)"\s*:\s*"([^"\\]+)"/))?.[1];
  throw new Error(fail ? `Pixmax ${fail[1].toLowerCase()}${msg ? `: ${msg}` : ""}` : `Pixmax returned no file${msg ? `: ${msg}` : ""}`);
}
