"use client";
/**
 * Platform adapters: real image and video renders on the platforms you connect, paid from their credits.
 *  - catalog: every image/video model a platform offers, merged into the studio's model list
 *  - render:  submit -> wait -> return the finished file's URL, with each platform's own inputs
 * Supported: Flick, OpenArt, ImagineArt, PixVerse (remote MCP via the bridge), Google Flow (local MCP) and Pixmax (CLI).
 */
import { useStudio } from "./store";
import { bridgeHeaders, mcpRpc, textOf } from "./bridge";
import type { MediaInput, ModelDef, ModelKind, Platform } from "./types";
import { uid } from "./util";

export type AdapterId = NonNullable<Platform["adapter"]>;

export function detectAdapter(pf: Pick<Platform, "tools"> & Partial<Pick<Platform, "mode" | "command">>): AdapterId | undefined {
  if (pf.mode === "cli" && /pixmax/i.test(pf.command || "")) return "pixmax";
  const n = new Set(pf.tools.map((t) => t.name));
  if (n.has("openart_generate_image")) return "openart";
  if (n.has("create_video") && n.has("generation_status") && n.has("capabilities")) return "pixverse";
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
  if (adapter === "pixverse") return pixverseCatalog(pf);
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

/* references: the bridge turns data: URLs and web URLs into bytes or local files for each platform */
async function bridgePost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const st = useStudio.getState();
  const r = await fetch(`${st.bridgeUrl}${path}`, { method: "POST", headers: { "content-type": "application/json", ...(await bridgeHeaders()) }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Bridge ${r.status}`);
  return j as T;
}
const refFile = (src: string) => bridgePost<{ path: string; type: string }>("/media/save", { src });
const refBytes = (src: string) => bridgePost<{ base64: string; type: string; size: number }>("/media/bytes", { src });
// data: URLs, web files, and files this computer's bridge serves (canvas uploads, Google Flow results)
const usable = (m: MediaInput) => !!m.url && /^(data:|https:|http:\/\/(127\.0\.0\.1|localhost):\d+\/files\/)/.test(m.url);
const isVideoUrl = (u: string) => u.startsWith("data:video/") || /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u);

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
  if (adapter === "pixverse") return pixverse(pf, nat.id, nat.mode || "", req, onLine);
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
  const skipped = (req.media || []).filter((m) => !onFlick(m)).length;
  if (skipped) onLine(`Flick can only use images made on Flick as references: ${skipped} other image${skipped === 1 ? "" : "s"} left out.`);
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
let oaModes: Record<string, string[]> | null = null;
/** OpenArt: upload one reference (signed PUT through the bridge) and return the visualReference its forms expect */
async function openartUpload(pf: Platform, src: string, purpose: string): Promise<unknown> {
  const b = await refBytes(src);
  const sign = parse<{ signURL?: string; signUrl?: string; accessURL?: string; uploadId?: string }>(
    await call(pf, "openart_upload_sign", { mediaType: b.type.startsWith("video") ? "video" : "image", size: b.size, contentType: b.type, purpose }),
  );
  const signUrl = sign?.signURL || sign?.signUrl;
  if (!signUrl || !sign?.accessURL) throw new Error("OpenArt didn't give an upload link");
  await bridgePost("/media/put", { signUrl, src, contentType: b.type });
  const mediaType = b.type.startsWith("video") ? "video" : "image";
  const meta = parse<{ visualReference?: unknown }>(await call(pf, "openart_upload_metadata_get", { mediaUrl: sign.accessURL, mediaType, ...(sign.uploadId ? { uploadId: sign.uploadId } : {}) }));
  if (!meta?.visualReference) throw new Error("OpenArt didn't accept the reference");
  return meta.visualReference;
}

async function openart(pf: Platform, model: string, mode: string, req: RenderRequest, onLine: Line): Promise<string> {
  const refs = (req.media || []).filter(usable);
  if (refs.length) {
    // pick the mode that takes images, if this model has one
    if (!oaModes) {
      const j = parse<{ models?: { id: string; modes?: { image?: { mode: string }[]; video?: { mode: string }[] } }[] }>(await call(pf, "openart_model_list", {}));
      oaModes = Object.fromEntries((j?.models || []).map((m) => [m.id, [...(m.modes?.image || []), ...(m.modes?.video || [])].map((x) => x.mode)]));
    }
    const modes = oaModes[model] || [];
    const want = req.kind === "image" ? ["image2image"] : refs.some((m) => m.role === "first") ? ["image2video", "element2video"] : ["element2video", "image2video"];
    const hit = want.find((w) => modes.includes(w));
    if (hit) mode = hit;
    else onLine(`OpenArt's ${model} has no image-input mode: rendering from the prompt only.`);
  }
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
  // reference fields: whatever this mode's form calls them (image / images / referenceImages / startFrame…)
  if (refs.length && !/^text2/.test(mode)) {
    onLine(`OpenArt: uploading ${refs.length} reference${refs.length === 1 ? "" : "s"}…`);
    const ups: unknown[] = [];
    for (const m of refs.slice(0, 6)) ups.push(await openartUpload(pf, m.url!, req.kind === "video" ? "create-video" : "create-image"));
    const fields = Object.keys(props).filter((k) => /image|frame|reference|element|subject/i.test(k) && !/count|num|ratio|strength|weight/i.test(k));
    const listField = fields.find((k) => props[k].type === "array");
    const oneField = fields.find((k) => props[k].type !== "array");
    if (listField) params[listField] = ups;
    else if (oneField) params[oneField] = ups[0];
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
  // web images can be passed as URLs; local ones (and every image, for Seedance models) are uploaded to ImagineArt first
  const all = [...(req.media || []).filter((m) => m.role === "first"), ...(req.media || []).filter((m) => m.role === "ref")].filter(usable);
  const ordered = all.filter((m) => !isVideoUrl(m.url!)).slice(0, 4);
  if (all.length > ordered.length && all.some((m) => isVideoUrl(m.url!))) onLine("ImagineArt takes image references only: video references were left out. Use OpenArt for video references.");
  const mustUpload = /seedance/i.test(model);
  const image_url: string[] = [];
  for (const m of ordered) {
    if (/^https:/.test(m.url!) && !mustUpload) {
      image_url.push(m.url!);
      continue;
    }
    onLine("ImagineArt: uploading a reference…");
    const file = m.url!.startsWith("data:") ? m.url! : await refBytes(m.url!).then((b) => `data:${b.type};base64,${b.base64}`);
    const up = await call(pf, "user_upload", { file, org_id });
    const u = up.match(/https?:\/\/[^\s"'<>)]+/)?.[0];
    if (!u) throw new Error(`ImagineArt didn't accept the reference: ${up.slice(0, 160)}`);
    image_url.push(u);
  }
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
  const refs = (req.media || []).filter(usable);
  if (refs.length) {
    onLine("Google Flow: preparing references…");
    const first = req.kind === "video" ? refs.find((m) => m.role === "first") : undefined;
    if (first) scene.first_frame = (await refFile(first.url!)).path;
    else scene.reference_images = await Promise.all(refs.filter((m) => m !== first).slice(0, 3).map(async (m) => (await refFile(m.url!)).path));
  }
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
  let refNode: string | undefined;
  const ref = [...(req.media || []).filter((m) => m.role === "first"), ...(req.media || []).filter((m) => m.role === "ref")].find(usable);
  if (ref) {
    onLine("Pixmax: uploading the reference…");
    const { path } = await refFile(ref.url!);
    const up = JSON.stringify(await pixmaxCall({ action: "upload", path, file }));
    refNode = up.match(/"(?:nodeUuid|node_uuid|uuid)"\s*:\s*"([0-9a-f-]{36})"/i)?.[1];
    if (!refNode) throw new Error(`Pixmax didn't place the reference on the canvas: ${up.slice(0, 160)}`);
    if ((req.media || []).filter(usable).length > 1) onLine("Pixmax uses one reference image: the first was used.");
  }
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
    refNode,
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

/* --- PixVerse: remote MCP (OAuth via the bridge); async tasks polled with generation_status --- */
// PixVerse publishes no prices through its server. Estimates (credits per image, or per ~5 s of 720p video) come from
// PixVerse's published API price table where it lists the model, otherwise a rough family estimate. The real charge
// is read from the account balance before and after each render and reported in the render log.
const PV_EST: [RegExp, number][] = [
  [/^v6$/, 45], [/^pixverse-c1$/, 50], [/^v5\.6$/, 45],
  [/4k/, 150], [/^veo-3\.1-standard/, 200], [/^veo-3\.1-fast/, 100], [/^veo-3\.1-lite/, 60], [/^sora-2-pro/, 200], [/^sora-2/, 80],
  [/^seedance-2\.5/, 100], [/^seedance-2\.0-standard/, 80], [/^seedance-2\.0-fast/, 50], [/^seedance-2\.0-mini/, 40],
  [/^kling.*pro/, 90], [/^kling/, 60], [/^wan-3/, 60], [/^minimax-h3-max/, 80], [/^minimax/, 60], [/^flux-3/, 60],
  [/^grok/, 40], [/^gemini-omni/, 50], [/^happyhorse/, 50],
  [/^gpt-image/, 20], [/nano-banana|gemini-3/, 15], [/^seedream/, 10], [/^kling-image/, 10], [/^qwen/, 8], [/^gemini/, 10],
];
const pvEstimate = (id: string, kind: ModelKind) => PV_EST.find(([re]) => re.test(id))?.[1] ?? (kind === "image" ? 10 : 60);
const PV_NAMES: Record<string, string> = { v6: "PixVerse V6", "v5.6": "PixVerse V5.6", "pixverse-c1": "PixVerse C1" };
const pvName = (id: string) =>
  PV_NAMES[id] ||
  id
    .split("-")
    .map((w) => (/^\d/.test(w) ? w.toUpperCase().replace(/^(\d+)K$/, "$1K") : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
    .replace(/^Gpt /, "GPT ")
    .replace(/^Minimax /, "MiniMax ")
    .replace(/ (\d)K$/, " $1K");

type PvParam = { supported?: boolean | null; enum?: unknown[] | null; max_count?: number };
type PvCaps = { models?: Record<string, { parameters?: Record<string, PvParam> }>; default_model?: string };

/** tools/call on PixVerse, returning its structured reply (or the JSON inside its text) */
async function pvCall<T = Record<string, unknown>>(pf: Platform, name: string, args: Record<string, unknown>): Promise<T & { _text: string }> {
  const r = (await mcpRpc(pf, "tools/call", { name, arguments: args })) as { isError?: boolean; structuredContent?: unknown } | null;
  const text = textOf(r);
  if (r?.isError) throw new Error(`PixVerse: ${text.slice(0, 300) || `${name} failed`}`);
  const sc = (r?.structuredContent as T) || parse<T>(text.split("Result JSON:").pop() || text) || ({} as T);
  return { ...sc, _text: text };
}

async function pixverseCatalog(pf: Platform): Promise<CatalogEntry[]> {
  const [video, image, ref] = await Promise.all(["video", "image", "reference"].map((mode) => pvCall<PvCaps>(pf, "capabilities", { mode })));
  const list = (p: PvParam | undefined) => (p && p.supported !== false && Array.isArray(p.enum) ? p.enum : []);
  const out: CatalogEntry[] = [];
  for (const [id, m] of Object.entries(image.models || {})) {
    const p = m.parameters || {};
    out.push({ native: id, name: pvName(id), kind: "image", credits: pvEstimate(id, "image"), mode: `img:${p.images?.max_count || 0}`, resolutions: list(p.quality).map(String) });
  }
  for (const [id, m] of Object.entries(video.models || {})) {
    const p = m.parameters || {};
    const r = ref.models?.[id]?.parameters;
    // mode carries what references the model takes: "ref:<images>:<videos>" when it has a reference mode
    const mode = (r ? `ref:${r.images?.max_count || 0}:${r.videos?.max_count || 0}` : `frame:${p.images?.max_count || 0}`) + (id === "grok-imagine-1.5" ? ":needs-image" : "");
    out.push({ native: id, name: pvName(id), kind: "video", credits: pvEstimate(id, "video"), mode, durations: list(p.duration).map(Number).filter((d) => d > 0), resolutions: list(p.quality).map(String) });
  }
  return out;
}

async function pvBalance(pf: Platform): Promise<number | null> {
  try {
    const a = await pvCall<{ credits?: { total?: number } }>(pf, "account", {});
    return typeof a.credits?.total === "number" ? a.credits.total : null;
  } catch {
    return null;
  }
}

/** PixVerse takes its own renders, or files at a public https address (imported first); never local uploads. */
async function pvReference(pf: Platform, m: MediaInput, onLine: Line): Promise<{ type: string; id: string } | null> {
  const nat = m.native?.platformId === pf.id ? m.native.id : "";
  if (nat) {
    const [type, id] = nat.includes(":") ? nat.split(":") : [isVideoUrl(m.url || "") ? "video" : "image", nat];
    return { type, id };
  }
  if (!m.url || !/^https:/.test(m.url)) return null;
  const media_type = isVideoUrl(m.url) ? "video" : "image";
  onLine(`PixVerse: importing a ${media_type} reference…`);
  const imp = await pvCall<{ operation_id?: string }>(pf, "import_url", { url: m.url, media_type, client_request_id: uid() });
  const op = imp.operation_id || imp._text.match(/operation_id\D{0,6}([\w-]+)/)?.[1];
  if (!op) throw new Error(`PixVerse didn't accept the reference: ${imp._text.slice(0, 160)}`);
  for (let i = 0; i < 40; i++) {
    const s = await pvCall<{ status?: string; asset_id?: string | number; error?: unknown }>(pf, "import_status", { operation_id: op });
    if (s.asset_id) return { type: "upload", id: String(s.asset_id) };
    if (/fail|error/i.test(String(s.status || ""))) throw new Error(`PixVerse couldn't import the reference: ${s._text.slice(0, 160)}`);
    await sleep(3000);
  }
  throw new Error("PixVerse took too long to import the reference");
}

async function pixverse(pf: Platform, model: string, mode: string, req: RenderRequest, onLine: Line): Promise<RenderResult> {
  const kind = req.kind === "image" ? "image" : "video";
  const media = (req.media || []).filter((m) => m.url || m.native);
  const refs: { type: string; id: string; role: string; video: boolean }[] = [];
  let skipped = 0;
  for (const m of media) {
    const r = await pvReference(pf, m, onLine);
    if (r) refs.push({ ...r, role: m.role, video: r.type === "video" || isVideoUrl(m.url || "") });
    else skipped++;
  }
  if (skipped)
    onLine(`PixVerse only takes references that are PixVerse renders or files at a public https link: ${skipped} reference${skipped === 1 ? " was" : "s were"} left out. Render the reference on PixVerse first, or use another platform for uploaded files.`);
  if (/needs-image/.test(mode) && !refs.length) throw new Error(`${pvName(model)} on PixVerse needs a first-frame image`);

  const args: Record<string, unknown> = { prompt: req.prompt, model, client_request_id: uid() };
  if (req.aspect) args.aspect_ratio = req.aspect;
  if (req.resolution) args.quality = req.resolution;
  if (kind === "image") {
    const max = Number(mode.split(":")[1] || 0);
    const imgs = refs.filter((r) => !r.video).slice(0, max);
    if (imgs.length) args.images = imgs.map(({ type, id }) => ({ type, id }));
  } else {
    args.duration = Math.round(req.duration || 5);
    const [, maxImg, maxVid] = mode.split(":").map(Number);
    const extra = refs.filter((r) => r.role === "ref");
    if (extra.length && mode.startsWith("ref:")) {
      // several references: PixVerse's reference mode keeps each one separate
      args.mode = "reference";
      const imgs = refs.filter((r) => !r.video).slice(0, maxImg);
      const vids = refs.filter((r) => r.video).slice(0, maxVid || 0);
      if (imgs.length) args.images = imgs.map(({ type, id }) => ({ type, id }));
      if (vids.length) args.videos = vids.map(({ type, id }) => ({ type, id }));
      if (refs.length > imgs.length + vids.length) onLine(`${pvName(model)} takes up to ${maxImg} images and ${maxVid || 0} videos as references: the rest were left out.`);
    } else {
      const first = refs.find((r) => !r.video);
      if (first) args.images = [{ type: first.type, id: first.id }];
      if (extra.length) onLine(`${pvName(model)} on PixVerse animates one first frame; pick a model with reference mode (Seedance, Kling O3, Wan 3.0, V6…) to use several references.`);
    }
  }

  const before = await pvBalance(pf);
  onLine(`PixVerse: ${pvName(model)}…`);
  const sub = await pvCall<Record<string, unknown>>(pf, kind === "image" ? "create_image" : "create_video", args);
  const ids = (sub[`${kind}_ids`] as unknown[]) || (sub.ids as unknown[]) || [];
  const id = String(ids[0] ?? sub[`${kind}_id`] ?? sub.id ?? sub._text.match(new RegExp(`${kind}_ids?\\D{0,8}(\\d{6,})`))?.[1] ?? "");
  if (!/^\d+$/.test(id)) throw new Error(`PixVerse didn't start the ${kind}: ${sub._text.slice(0, 200)}`);
  // generation keeps going if the page closes; the id lets it be recovered
  onLine(`PixVerse task ${id} submitted; waiting for the result…`);
  for (let i = 0; i < 70; i++) {
    const s = await pvCall<Record<string, unknown>>(pf, "generation_status", { type: kind, id, wait_seconds: 20 });
    const status = String(s.status ?? s.state ?? "").toLowerCase();
    const url = [s.url, s.media_url, s.result_url, (s.result as { url?: string } | undefined)?.url].find((u) => typeof u === "string" && /^https:/.test(u)) as string | undefined;
    if (/fail|moderat|reject|cancel/.test(status)) throw new Error(`PixVerse ${kind} ${status}: ${s._text.slice(0, 200)}`);
    if (url && (!status || /complet|success|done|finish|^1$/.test(status))) {
      const after = await pvBalance(pf);
      if (before !== null && after !== null) onLine(`PixVerse charged ${before - after} credits (balance ${after}).`);
      return { url, nativeId: `${kind}:${id}` };
    }
    if (!status && !url && i > 2 && /error/i.test(s._text)) throw new Error(`PixVerse: ${s._text.slice(0, 200)}`);
  }
  throw new Error(`PixVerse is still rendering task ${id}: it will appear in your PixVerse library.`);
}
