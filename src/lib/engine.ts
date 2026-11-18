"use client";
/**
 * The Claude "Power Engine". Every studio operation goes through here:
 *  - breakdownScript   : Showrunner — script/idea → scenes, beats, dialogue, shot lists (JSON)
 *  - compilePrompt     : Optical Prompt Compiler — UI camera state → model-specific prompt
 *  - continuity        : Continuity & Asset Guardian — cast/wardrobe/lighting descriptors
 *  - generateAdapter   : Zero-code adapter — raw API docs → registry entry + adapter code
 * With a Claude API key it calls the Anthropic Messages API from the browser. Without a key
 * (or if the call fails) it runs a local rule-based engine so the studio keeps working.
 */
import { useStudio } from "./store";
import { decryptSecret } from "./secure";
import type { CastMember, CinemaSettings, Episode, ModelDef, PromptStyle, Scene, Shot, VaultRef } from "./types";
import { tempoLabel } from "./presets";
import { uid } from "./util";

export const CLAUDE_MODELS = [
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 — balanced (default)" },
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 — deepest reasoning" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 — fastest" },
];

type Result<T> = { value: T; mode: "live" | "local"; note?: string };

/** Which Claude the Power Engine will use: an API key, your Claude Code sign-in through the local bridge, or none. */
export function claudeSource(): "api" | "claude-code" | "none" {
  const st = useStudio.getState();
  if (st.claudeKeyEnc) return "api";
  if (st.bridgeTokenEnc) return "claude-code";
  return "none";
}

/** Claude through Claude Code on this computer (your Pro/Max sign-in), via the local bridge's /claude route. */
async function callClaudeCode(system: string, user: string): Promise<string | null> {
  const st = useStudio.getState();
  const token = await decryptSecret(st.bridgeTokenEnc);
  if (!token) return null;
  let res: Response;
  try {
    res = await fetch(`${st.bridgeUrl}/claude`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-bridge-token": token },
      body: JSON.stringify({ system, user, model: st.claudeModel }),
    });
  } catch {
    throw new Error("Local bridge isn't running — start it with: node bridge/fsc-bridge.mjs");
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Claude Code: ${j.error || res.status}`);
  return String(j.text ?? "");
}

/** One Claude call: the API when a key is saved, otherwise Claude Code through the local bridge. null = no Claude set up. */
export async function callClaude(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  const st = useStudio.getState();
  const key = await decryptSecret(st.claudeKeyEnc);
  if (!key) return callClaudeCode(system, user);
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: st.claudeModel,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude API ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("\n");
  return text;
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(raw) as T;
}

async function run<T>(task: string, live: () => Promise<T | null>, local: () => T): Promise<Result<T>> {
  const st = useStudio.getState();
  const t0 = performance.now();
  try {
    const v = await live();
    if (v !== null) {
      st.log({ task, mode: "live", model: st.claudeModel, ms: Math.round(performance.now() - t0), ok: true });
      return { value: v, mode: "live" };
    }
  } catch (e) {
    const note = e instanceof Error ? e.message : String(e);
    const value = local();
    st.log({ task, mode: "local", model: "local engine", ms: Math.round(performance.now() - t0), ok: false, note: `Claude call failed, used local engine: ${note}` });
    return { value, mode: "local", note };
  }
  const value = local();
  st.log({ task, mode: "local", model: "local engine", ms: Math.round(performance.now() - t0), ok: true, note: "No Claude set up (no bridge or API key)" });
  return { value, mode: "local" };
}

/* ------------------------------------------------------------------ */
/* Continuity & Asset Guardian                                         */
/* ------------------------------------------------------------------ */

export function continuityLocal(cast: CastMember[], refs: VaultRef[], settings: CinemaSettings, prev?: Shot): string {
  const parts: string[] = [];
  cast.forEach((c) => {
    const w = c.wardrobe.find((x) => x.id === c.activeWardrobe) || c.wardrobe[0];
    parts.push(`${c.name}: ${c.face}${w ? `; wearing ${w.description}` : ""}${c.styleTags.length ? `; look: ${c.styleTags.join(", ")}` : ""}`);
  });
  refs.forEach((r) => parts.push(`${r.kind} "${r.name}": ${r.description}`));
  if (prev) {
    parts.push(
      `match previous shot "${prev.title}": same ${prev.settings.lighting.toLowerCase()} light direction, ${prev.settings.camera} texture, keep screen direction and eyelines consistent, open on its final frame`,
    );
  }
  parts.push(`lighting continuity: ${settings.lighting.toLowerCase()}`);
  return parts.join(" | ");
}

export async function continuity(cast: CastMember[], refs: VaultRef[], settings: CinemaSettings, prev?: Shot): Promise<Result<string>> {
  return run(
    "Continuity Guardian",
    async () => {
      const text = await callClaude(
        "You are the Continuity & Asset Guardian for an AI film studio. Produce one compact line of visual consistency descriptors (identity, wardrobe, props, lighting direction, colour grade, spatial positioning/screen direction) to inject into the next shot prompt. No preamble.",
        JSON.stringify({ cast, references: refs, settings, previousShot: prev ? { title: prev.title, prompt: prev.compiled || prev.prompt, settings: prev.settings } : null }),
        400,
      );
      return text ? text.trim() : null;
    },
    () => continuityLocal(cast, refs, settings, prev),
  );
}

/* ------------------------------------------------------------------ */
/* Optical Prompt Compiler                                             */
/* ------------------------------------------------------------------ */

const CAMERA_TEXT: Record<string, string> = {
  "35mm Film": "shot on 35mm film, organic grain, rich halation",
  "8mm Vintage": "super 8mm home-movie look, gate weave, heavy grain, faded colours",
  "Modern Digital": "modern large-format digital cinema camera, clean high dynamic range",
  "DV Camcorder": "early 2000s DV camcorder, interlaced edges, low dynamic range, candid feel",
  "Classic 16mm Film": "16mm film, documentary texture, visible grain",
  "Modular 8K Digital": "8K modular digital cinema camera, razor detail",
};
const LENS_TEXT: Record<string, string> = {
  Anamorphic: "anamorphic lens, oval bokeh, horizontal flares, slight edge distortion",
  "Vintage Prime": "vintage prime lens, soft contrast, swirly bokeh",
  "Clean Spherical": "clean spherical lens, neutral rendering, sharp edges",
  "Warm Cinema Prime": "warm cinema prime, gentle roll-off",
  Macro: "macro lens, extreme close detail",
  Fisheye: "fisheye lens, curved horizon",
};

function apertureText(a: string) {
  const n = parseFloat(a.replace("f/", ""));
  if (n <= 2) return `${a}, very shallow depth of field, creamy background separation`;
  if (n <= 4) return `${a}, moderate depth of field`;
  return `${a}, deep focus, everything sharp`;
}

function moveText(m: { type: string; amount: number }) {
  const speed = m.amount < 34 ? "subtle" : m.amount < 67 ? "steady" : "aggressive";
  return `${speed} ${m.type.toLowerCase()}`;
}

export function compileLocal(prompt: string, s: CinemaSettings, model: ModelDef, cont = ""): string {
  const style: PromptStyle = model.promptStyle;
  const subject = prompt.trim() || "a cinematic moment";
  const moves = s.moves.map(moveText);
  const pace = tempoLabel(s.tempo).toLowerCase();
  const cam = CAMERA_TEXT[s.camera] || s.camera;
  const lens = `${LENS_TEXT[s.lens] || s.lens}, ${s.focal}mm`;
  const ap = apertureText(s.aperture);
  const light = `${s.lighting.toLowerCase()} lighting`;
  const genre = `${s.genre.toLowerCase()} tone`;

  switch (style) {
    case "tags":
      return [subject, moves.join(" + "), cam, lens, ap, light, genre, `${pace} pacing`, cont && `consistency: ${cont}`, `${s.aspect}`, "cinematic, high detail, natural motion"]
        .filter(Boolean)
        .join(", ");
    case "timecoded": {
      const d = s.duration;
      const a = Math.max(1, Math.round(d * 0.35));
      const b = Math.max(a + 1, Math.round(d * 0.75));
      return [
        `[0-${a}s] ${subject}. Camera: ${moves[0] || "static"}.`,
        `[${a}-${b}s] action develops with ${pace} pacing${moves[1] ? `, camera transitions into ${moves[1]}` : ""}.`,
        `[${b}-${d}s] hold on the emotional beat, settle the frame.`,
        `Look: ${cam}; ${lens}; ${ap}; ${light}; ${genre}.`,
        cont && `Continuity: ${cont}.`,
        s.audio ? "Audio: natural ambience and synced dialogue." : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    case "weighted":
      return `(${subject}:1.3), (${s.lighting.toLowerCase()}:1.15), (${s.camera.toLowerCase()} look:1.1), ${lens}, ${ap}, ${genre}, cinematic still${cont ? `, ${cont}` : ""}\nNegative prompt: blurry, extra limbs, deformed hands, watermark, text, oversaturated, low quality`;
    case "mj":
      return `${subject}, ${light}, ${cam}, ${lens}, ${genre}${cont ? `, ${cont}` : ""} --ar ${s.aspect} --style raw --stylize 250`;
    default:
      return `${subject}. The camera performs a ${moves.join(", then a ")}, with ${pace} pacing. ${cap(cam)}, ${lens}, ${ap}. ${cap(light)} sets a ${genre}.${cont ? ` Continuity: ${cont}.` : ""}${s.audio && model.capabilities.includes("native_audio") ? " Sound: natural ambience, subtle room tone, dialogue in sync." : ""}`;
  }
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STYLE_GUIDE: Record<PromptStyle, string> = {
  prose: "flowing cinematic prose; describe subject, action, camera move, lens and light in natural sentences; include sound cues when the model supports native audio",
  tags: "dense comma-separated descriptors ordered: subject+action, camera move, camera body, lens, aperture, light, mood, quality tags",
  timecoded: "a timecoded beat list like [0-3s] … [3-6s] … covering the full duration, then a Look line and Audio line",
  weighted: "Stable Diffusion syntax with (token:weight) emphasis and a separate 'Negative prompt:' line",
  mj: "Midjourney syntax: comma-separated description followed by --ar, --style raw and --stylize flags",
};

export async function compilePrompt(prompt: string, s: CinemaSettings, model: ModelDef, cont = ""): Promise<Result<string>> {
  return run(
    `Prompt Compiler → ${model.name}`,
    async () => {
      const text = await callClaude(
        `You are the Optical Prompt Compiler of an AI film studio. Translate the director's UI state into ONE hyper-optimised prompt for the target model "${model.name}" (${model.vendor}). Required syntax: ${STYLE_GUIDE[model.promptStyle]}. Respect the model's capabilities: ${model.capabilities.join(", ")}. Keep it under 120 words. Output only the prompt.`,
        JSON.stringify({ idea: prompt, camera: s, continuity: cont, tempo: tempoLabel(s.tempo) }),
        600,
      );
      return text ? text.trim() : null;
    },
    () => compileLocal(prompt, s, model, cont),
  );
}

/* ------------------------------------------------------------------ */
/* Showrunner & Breakdown Agent                                        */
/* ------------------------------------------------------------------ */

const EMOTIONS: [string, RegExp, number][] = [
  ["Dread", /\b(fear|dark|shadow|scream|blood|threat|flicker|shudder)\w*/i, 8],
  ["Confrontation", /\b(never|lie|knew|why|supposed|angry|slam|hesitat)\w*/i, 7],
  ["Resolve", /\b(together|finish|promise|decide|must|will)\b/i, 6],
  ["Longing", /\b(miss|hope|remember|alone|lights fall|silent)\w*/i, 5],
  ["Joy", /\b(laugh|smile|dance|celebrat|kiss)\w*/i, 4],
  ["Curiosity", /\b(search|scan|find|look|wonder|envelope)\w*/i, 4],
];

export function breakdownLocal(script: string, cast: CastMember[]): Pick<Episode, "title" | "logline" | "scenes"> {
  const lines = script.split(/\r?\n/).map((l) => l.trim());
  const title = lines.find((l) => l && !/^(INT|EXT)\./i.test(l)) || "Untitled episode";
  const heading = /^(INT\.|EXT\.|INT\/EXT\.|SCENE\b)/i;
  const blocks: { head: string; body: string[] }[] = [];
  lines.forEach((l) => {
    if (heading.test(l)) blocks.push({ head: l, body: [] });
    else if (l && blocks.length) blocks[blocks.length - 1].body.push(l);
  });
  if (!blocks.length) {
    // free-form idea: split into paragraphs / sentences into 3 acts
    const sentences = script.replace(/\n+/g, " ").split(/(?<=[.!?])\s+/).filter(Boolean);
    const n = sentences.length;
    ["Setup", "Confrontation", "Resolution"].forEach((act, i) => {
      const chunk = sentences.slice(Math.round((i * n) / 3), Math.round(((i + 1) * n) / 3));
      if (chunk.length) blocks.push({ head: `SCENE ${i + 1} — ${act.toUpperCase()}`, body: chunk });
    });
  }
  const names = new Set(cast.map((c) => c.name.toUpperCase()));
  const scenes: Scene[] = blocks.map((b, i) => {
    const dialogue = b.body
      .map((l) => l.match(/^([A-Z][A-Z .'-]{1,30}):\s*(.+)$/))
      .filter(Boolean)
      .map((m) => ({ character: cap(m![1].toLowerCase()), line: m![2] }));
    const action = b.body.filter((l) => !/^([A-Z][A-Z .'-]{1,30}):/.test(l));
    const text = b.body.join(" ");
    const emo = EMOTIONS.find(([, re]) => re.test(text)) || ["Neutral", /./, 3];
    const caps = (text.match(/\b[A-Z]{3,}\b/g) || []).filter((w) => names.has(w) || /^[A-Z]{3,}$/.test(w));
    const present = Array.from(new Set([...dialogue.map((d) => d.character), ...caps.map((w) => cap(w.toLowerCase()))])).filter((n) => !["INT", "EXT", "THE", "SCENE"].includes(n.toUpperCase()));
    const location = b.head.replace(heading, "").replace(/^[\s—-]+/, "").trim() || `Scene ${i + 1}`;
    const night = /night|dark|rain/i.test(b.head + text);
    const shots = [
      { id: uid("sp"), description: `Establishing: ${location.toLowerCase()}${action[0] ? ` — ${action[0]}` : ""}`, shotType: "Wide", movement: night ? "Crane Down" : "Dolly In", duration: 4, characters: [] as string[] },
      ...dialogue.slice(0, 4).map((d, k) => ({
        id: uid("sp"),
        description: `${d.character} delivers: "${d.line}"`,
        shotType: k % 2 ? "Over-the-shoulder" : "Medium close-up",
        movement: emo[2] > 6 ? "Handheld" : "Static",
        duration: Math.min(8, Math.max(3, Math.round(d.line.split(" ").length / 2.5))),
        characters: [d.character],
      })),
      { id: uid("sp"), description: `Reaction / button: ${action[action.length - 1] || "hold on faces"}`, shotType: "Close-up", movement: "Dolly In", duration: 3, characters: present.slice(0, 2) },
    ];
    return {
      id: uid("sc"),
      title: `Scene ${i + 1}: ${location}`,
      location,
      beat: i === 0 ? "Inciting incident" : i === blocks.length - 1 ? "Climax / turn" : "Rising tension",
      emotion: emo[0],
      intensity: Math.min(10, emo[2] + (i === blocks.length - 1 ? 1 : 0)),
      summary: action.slice(0, 2).join(" ") || text.slice(0, 160),
      dialogue,
      shots,
    };
  });
  return { title, logline: scenes.map((s) => s.summary.split(".")[0]).filter(Boolean).slice(0, 2).join(". ") + ".", scenes };
}

export async function breakdownScript(script: string, cast: CastMember[]): Promise<Result<Pick<Episode, "title" | "logline" | "scenes">>> {
  return run(
    "Showrunner breakdown",
    async () => {
      const text = await callClaude(
        `You are the AI Showrunner of a short-drama studio. Break the script or story idea into a JSON object:
{"title":string,"logline":string,"scenes":[{"title":string,"location":string,"beat":string,"emotion":string,"intensity":0-10,"summary":string,"dialogue":[{"character":string,"line":string}],"shots":[{"description":string,"shotType":string,"movement":string,"duration":number,"characters":[string]}]}]}
Use vertical-drama pacing (hooks, reversals, cliffhanger). Durations in seconds (2-10). Known cast: ${cast.map((c) => c.name).join(", ") || "none"}. Reply with JSON only.`,
        script,
        4000,
      );
      if (!text) return null;
      const j = extractJson<Pick<Episode, "title" | "logline" | "scenes">>(text);
      j.scenes = j.scenes.map((s) => ({ ...s, id: uid("sc"), dialogue: s.dialogue || [], shots: (s.shots || []).map((p) => ({ ...p, id: uid("sp"), characters: p.characters || [] })) }));
      return j;
    },
    () => breakdownLocal(script, cast),
  );
}

/* ------------------------------------------------------------------ */
/* Zero-code Model Adapter Generator                                   */
/* ------------------------------------------------------------------ */

export type AdapterDraft = Partial<ModelDef>;

export function adapterLocal(docs: string): AdapterDraft {
  const url = (docs.match(/https?:\/\/[^\s"'`)<>]+/g) || []).find((u) => !/docs|example\.com\/docs|github/.test(u)) || "";
  const lower = docs.toLowerCase();
  const kind = /video|fps|duration|frames/.test(lower) ? "video" : /speech|voice|tts|audio/.test(lower) && !/image/.test(lower) ? "audio" : "image";
  const provider = /fal\.(run|ai)/.test(lower) ? "fal" : /replicate/.test(lower) ? "replicate" : /aiplatform|vertex/.test(lower) ? "vertex" : /openrouter/.test(lower) ? "openrouter" : /localhost|127\.0\.0\.1/.test(lower) ? "webhook" : "rest";
  const keys = Array.from(new Set((docs.match(/"([a-z_][a-z0-9_]{1,40})"\s*:/gi) || []).map((k) => k.replace(/[":\s]/g, ""))));
  const pick = (...c: string[]) => keys.find((k) => c.includes(k.toLowerCase()));
  const paramMap: ModelDef["paramMap"] = {};
  const set = (app: keyof ModelDef["paramMap"], ...c: string[]) => {
    const k = pick(...c);
    if (k) paramMap[app] = k;
  };
  set("prompt", "prompt", "text", "input_text", "caption");
  set("negative_prompt", "negative_prompt", "negative");
  set("aspect_ratio", "aspect_ratio", "aspectratio", "ratio", "size");
  set("duration", "duration", "seconds", "length", "duration_seconds", "num_seconds");
  set("resolution", "resolution", "quality");
  set("cfg_scale", "cfg_scale", "guidance_scale", "guidance", "cfg");
  set("seed", "seed");
  set("reference_urls", "reference_image_urls", "image_urls", "reference_images", "refs");
  set("first_frame_url", "image_url", "first_frame", "start_image", "init_image", "first_frame_image");
  set("last_frame_url", "end_image_url", "last_frame", "tail_image_url", "end_image", "last_frame_image");
  set("audio", "audio", "generate_audio", "with_audio");
  if (!paramMap.prompt) paramMap.prompt = "prompt";
  const resp = docs.match(/"(video|videos|images|output|data|result)"\s*:\s*[[{]?\s*"?(url|uri)?/i);
  const responsePath = resp ? (resp[1].toLowerCase() === "images" || resp[1].toLowerCase() === "data" || resp[1].toLowerCase() === "videos" ? `${resp[1]}.0.url` : `${resp[1]}.url`) : kind === "video" ? "video.url" : "images.0.url";
  const caps: ModelDef["capabilities"] = [];
  if (kind === "video") caps.push("t2v");
  if (kind === "image") caps.push("t2i");
  if (paramMap.first_frame_url) caps.push(kind === "video" ? "i2v" : "i2i");
  if (paramMap.last_frame_url) caps.push("first_last");
  if (paramMap.reference_urls) caps.push("char_ref");
  if (paramMap.audio || /native audio|with sound/.test(lower)) caps.push("native_audio");
  if (/motion transfer|reference video|driving video/.test(lower)) caps.push("motion_transfer");
  const nameMatch = docs.match(/^#?\s*([A-Z][\w .-]{2,40})(?:\s+API)?\s*$/m);
  return {
    name: nameMatch ? nameMatch[1].trim() : "New model",
    kind,
    provider,
    endpoint: url,
    capabilities: caps,
    paramMap,
    responsePath,
    staticParams: "{}",
    notes: `Parsed locally from ${keys.length} payload keys. Connect Claude for a deeper read of the docs.`,
  };
}

export function adapterCode(d: AdapterDraft) {
  const map = JSON.stringify(d.paramMap || {}, null, 2).replace(/\n/g, "\n  ");
  return `// Auto-generated adapter for ${d.name || "model"} (${d.provider})
export const adapter = {
  endpoint: ${JSON.stringify(d.endpoint || "")},
  auth: ${JSON.stringify(d.provider === "fal" ? "Authorization: Key <API_KEY>" : "Authorization: Bearer <API_KEY>")},
  paramMap: ${map},
  buildRequest(controls) {
    const body = ${d.staticParams && d.staticParams !== "{}" ? d.staticParams : "{}"};
    for (const [app, key] of Object.entries(this.paramMap)) {
      if (controls[app] !== undefined) setPath(body, key, controls[app]);
    }
    return ${d.provider === "replicate" ? "{ input: body }" : "body"};
  },
  parseResponse(json) {
    return getPath(json, ${JSON.stringify(d.responsePath || "url")});
  },
};`;
}

export async function generateAdapter(docs: string): Promise<Result<AdapterDraft>> {
  return run(
    "Adapter Generator",
    async () => {
      const text = await callClaude(
        `You write request/response adapters for an AI film studio's model registry. Read the pasted API documentation and reply with JSON only:
{"name":string,"vendor":string,"kind":"video"|"image"|"audio","provider":"rest"|"fal"|"replicate"|"vertex"|"openrouter"|"webhook","endpoint":string,"method":"POST","capabilities":[subset of "t2i","i2i","t2v","i2v","first_last","char_ref","native_audio","motion_transfer"],"paramMap":{appParam:payloadKeyDotPath} where appParam in prompt,negative_prompt,aspect_ratio,duration,resolution,cfg_scale,seed,reference_urls,first_frame_url,last_frame_url,audio,"staticParams":stringified JSON of fixed fields,"responsePath":dot path to the output URL,"promptStyle":"prose"|"tags"|"timecoded"|"weighted"|"mj","maxDuration":number,"notes":string,"adapterCode":string (a small JS module with buildRequest(controls) and parseResponse(json))}`,
        docs.slice(0, 30000),
        3000,
      );
      if (!text) return null;
      return extractJson<AdapterDraft>(text);
    },
    () => {
      const d = adapterLocal(docs);
      return { ...d, adapterCode: adapterCode(d) };
    },
  );
}

export async function testClaude(): Promise<string> {
  const t = await callClaude("Reply with exactly: Power Engine online.", "ping", 20);
  if (t === null) throw new Error("Claude isn't set up: connect the local bridge below (uses your Claude Code sign-in) or save an API key.");
  return `${t.trim()} (${claudeSource() === "api" ? "Anthropic API" : "Claude Code sign-in"})`;
}
