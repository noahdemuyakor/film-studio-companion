"use client";
/**
 * Universal Platform Bridge: MCP client (remote over HTTP/SSE, local stdio through the companion bridge),
 * CLI subprocess bridge, API submit→poll→fetch worker, live credit ledger and the Claude credit router.
 */
import { useStudio } from "./store";
import { decryptSecret } from "./secure";
import type { LedgerEntry, McpTool, ModelDef, Platform, RouteMode, RoutePlan } from "./types";
import { getPath, uid } from "./util";
import { estimateCost } from "./router";
import { callClaude, claudeSource } from "./engine";
import { detectAdapter, renderOn } from "./adapters";

/* ------------------------------ MCP client ------------------------------ */

const sessions: Record<string, string> = {};
let rpcId = 1;

function parseRpcBody(text: string) {
  const t = text.trim();
  if (t.startsWith("{")) return JSON.parse(t);
  // text/event-stream: take the last "data:" JSON payload that carries a result or error
  const datas = t.split(/\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim());
  for (let k = datas.length - 1; k >= 0; k--) {
    try {
      const j = JSON.parse(datas[k]);
      if (j.result || j.error) return j;
    } catch {
      /* keep looking */
    }
  }
  throw new Error("MCP server sent an unreadable reply");
}

export async function bridgeHeaders(): Promise<Record<string, string>> {
  const token = await decryptSecret(useStudio.getState().bridgeTokenEnc);
  return token ? { "x-bridge-token": token } : {};
}

/** One JSON-RPC call to an MCP server: remote (Streamable HTTP) or local stdio through the bridge. */
export async function mcpRpc(pf: Platform, method: string, params: unknown = {}) {
  const st = useStudio.getState();
  if (pf.mode === "mcp-stdio") {
    const res = await fetch(`${st.bridgeUrl}/mcp/${encodeURIComponent(pf.id)}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await bridgeHeaders()) },
      body: JSON.stringify({ config: pf.mcpConfig, method, params }),
    });
    if (!res.ok) throw new Error(`Bridge ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return (await res.json()).result;
  }
  if (!pf.url) throw new Error("Add the MCP server URL first");
  const token = await decryptSecret(pf.tokenEnc);
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (sessions[pf.id]) headers["mcp-session-id"] = sessions[pf.id];
  const res = await fetch(pf.url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method, params }) });
  const sid = res.headers.get("mcp-session-id");
  if (sid) sessions[pf.id] = sid;
  if (res.status === 401) throw new Error("Server needs sign-in (OAuth 2.1). Paste an access token for this platform.");
  if (!res.ok) throw new Error(`MCP ${res.status}: ${(await res.text()).slice(0, 160)}`);
  if (res.status === 202) return null;
  const j = parseRpcBody(await res.text());
  if (j.error) throw new Error(j.error.message || "MCP error");
  return j.result;
}

/**
 * A read-only balance tool, judged by its NAME only (get_credits, get_balance, openart_account_get, check_balance…).
 * Descriptions are ignored on purpose: generate tools often say "costs credits", and calling one to read a balance
 * would start (and pay for) a job.
 */
export function isBalanceTool(name: string): boolean {
  const n = name.toLowerCase();
  const ACTIONS = new Set("create edit render run delete remove upload publish animate enhance upscale update select open narrate assemble download continue trash retry cancel buy purchase topup top charge spend submit send".split(" "));
  if (n.split(/[^a-z0-9]+/).some((w) => ACTIONS.has(w) || w.startsWith("generat"))) return false;
  return /(^|[_-])(get[_-])?(balance|credits?|wallet|quota)([_-]|$)|account[_-]?(get|info)|credit[_-]check|check[_-]balance/.test(n);
}

export function classifyTool(name: string, description = ""): McpTool["role"] {
  const s = `${name} ${description}`.toLowerCase();
  if (isBalanceTool(name)) return "balance";
  if (/status|poll|job|progress/.test(s)) return "status";
  if (/list_models|models/.test(s)) return "models";
  if (/character|asset|library|element/.test(s)) return "assets";
  if (/generat|create|render|video|image|imagine/.test(s)) return "generate";
  return "other";
}

/** initialize → notifications/initialized → tools/list */
export async function mcpDiscover(pf: Platform): Promise<McpTool[]> {
  delete sessions[pf.id];
  await mcpRpc(pf, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "film-studio-companion", version: "1.0.0" } });
  try {
    await mcpRpc(pf, "notifications/initialized", {});
  } catch {
    /* some servers reply 202 with no body */
  }
  const r = await mcpRpc(pf, "tools/list", {});
  const tools = ((r?.tools || []) as { name: string; description?: string }[]).map((t) => ({ name: t.name, description: t.description, role: classifyTool(t.name, t.description) }));
  return tools;
}

export function textOf(result: unknown): string {
  const c = (result as { content?: { type: string; text?: string }[] })?.content || [];
  return c.filter((x) => x.type === "text").map((x) => x.text).join("\n");
}

/** A credit balance from a tool/API reply: a credits/balance field first, then a number next to those words, then a standalone number (never digits inside an id). */
function firstNumber(s: string): number | null {
  const BAL = /^(credits?|balance|remaining(_credits)?|available(_credits)?|credits?_(left|remaining|balance))$/i;
  const fromJson = (o: unknown): number | null => {
    if (!o || typeof o !== "object") return null;
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (BAL.test(k)) {
        const n = typeof v === "number" ? v : typeof v === "string" && /^-?[\d,]+(\.\d+)?$/.test(v.trim()) ? Number(v.replace(/,/g, "")) : null;
        if (n !== null && Number.isFinite(n)) return n;
      }
    }
    for (const v of Object.values(o as Record<string, unknown>)) {
      const n = fromJson(v);
      if (n !== null) return n;
    }
    return null;
  };
  try {
    const n = fromJson(JSON.parse(s));
    if (n !== null) return n;
  } catch {
    /* not JSON */
  }
  const near = s.match(/(?:credits?|balance)\D{0,24}?(-?\d[\d,]*(?:\.\d+)?)(?![\w])/i) || s.match(/(?<![\w.])(-?\d[\d,]*(?:\.\d+)?)\s*(?:credits?|cr)\b/i);
  if (near) return Number(near[1].replace(/,/g, ""));
  const m = s.match(/(?<![\w.-])-?\d[\d,]*(?:\.\d+)?(?![\w])/);
  return m ? Number(m[0].replace(/,/g, "")) : null;
}

function firstUrl(s: string): string | undefined {
  return (s.match(/https?:\/\/[^\s"'<>)]+/) || [])[0];
}

/* ------------------------------ CLI bridge ------------------------------ */

export function fillTemplate(tpl: string, vars: Record<string, unknown>) {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? "" : String(vars[k])));
}

/** Split a flag template into argv safely (quoted values stay together, nothing is shell-evaluated). */
export function toArgv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q: string | null = null;
  for (const ch of line) {
    if (q) {
      if (ch === q) q = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") q = ch;
    else if (/\s/.test(ch)) {
      if (cur) out.push(cur), (cur = "");
    } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

export async function runCli(pf: Platform, vars: Record<string, unknown>, onLine?: (l: string) => void): Promise<{ files: string[]; stdout: string }> {
  const st = useStudio.getState();
  const args = toArgv(fillTemplate(pf.argTemplate, vars)).map((a) => a);
  // values substituted into flags are passed as separate argv entries, never through a shell
  const res = await fetch(`${st.bridgeUrl}/cli/run`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await bridgeHeaders()) },
    body: JSON.stringify({ command: pf.command, args, cwdName: pf.id }),
  });
  if (!res.ok || !res.body) throw new Error(`Bridge ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let stdout = "";
  let files: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const l of lines) {
      if (!l.startsWith("data:")) continue;
      const ev = JSON.parse(l.slice(5));
      if (ev.type === "stdout" || ev.type === "stderr") {
        stdout += ev.text;
        onLine?.(ev.text);
      }
      if (ev.type === "exit") {
        files = ev.files || [];
        if (ev.code !== 0) throw new Error(`${pf.command} exited with code ${ev.code}`);
      }
    }
  }
  return { files, stdout };
}

export async function bridgeHealth(): Promise<string> {
  const st = useStudio.getState();
  const r = await fetch(`${st.bridgeUrl}/health`, { headers: await bridgeHeaders() });
  if (!r.ok) throw new Error(`Bridge replied ${r.status}`);
  const j = await r.json();
  return `Bridge v${j.version} online · ${j.allowed?.length ?? 0} allowed commands`;
}

/* ------------------------------ API worker ------------------------------ */

async function apiJob(pf: Platform, payload: unknown, onLine?: (l: string) => void): Promise<string | undefined> {
  const token = await decryptSecret(pf.tokenEnc);
  const h: Record<string, string> = { "content-type": "application/json" };
  if (token) h.authorization = `Bearer ${token}`;
  const sub = await fetch(pf.url.replace(/\/$/, "") + pf.submitPath, { method: "POST", headers: h, body: JSON.stringify(payload) });
  if (!sub.ok) throw new Error(`${pf.name} submit ${sub.status}`);
  const job = await sub.json();
  const id = job.id || job.job_id || job.request_id;
  onLine?.(`submitted job ${id}`);
  for (let k = 0; k < 120; k++) {
    await new Promise((r) => setTimeout(r, 2500));
    const pr = await fetch(pf.url.replace(/\/$/, "") + pf.pollPath.replace("{id}", encodeURIComponent(id)), { headers: h });
    const pj = await pr.json();
    const status = String(pj.status || pj.state || "").toLowerCase();
    onLine?.(`status: ${status || "…"}`);
    if (/fail|error|cancel/.test(status)) throw new Error(`${pf.name} job ${status}`);
    const url = getPath(pj, pf.assetPath);
    if (typeof url === "string") return url;
  }
  throw new Error(`${pf.name} job timed out`);
}

/* ------------------------------ Wallet & ledger ------------------------------ */

export function addLedger(platformId: string, delta: number, reason: string, source: LedgerEntry["source"], absolute?: number) {
  const st = useStudio.getState();
  const pf = st.platforms.find((x) => x.id === platformId);
  if (!pf) return;
  const after = absolute !== undefined ? absolute : Math.max(0, Math.round((pf.balance + delta) * 100) / 100);
  st.set({
    platforms: st.platforms.map((x) => (x.id === platformId ? { ...x, balance: after, lastSync: source === "live" ? Date.now() : x.lastSync } : x)),
    ledger: [{ id: uid("lg"), platformId, delta: absolute !== undefined ? after - pf.balance : delta, reason, at: Date.now(), after, source }, ...st.ledger].slice(0, 300),
  });
}

/** Ask the platform for its live balance (MCP balance tool or API path). Returns null when unavailable. */
export async function syncBalance(pf: Platform): Promise<number | null> {
  try {
    if ((pf.mode === "mcp-remote" || pf.mode === "mcp-stdio") && pf.status === "connected") {
      // re-check by name: tool lists saved before this fix may have generate tools tagged as "balance"
      const tool = pf.tools.find((t) => isBalanceTool(t.name))?.name || (pf.balancePath && isBalanceTool(pf.balancePath) ? pf.balancePath : "");
      if (!tool) return null;
      const r = await mcpRpc(pf, "tools/call", { name: tool, arguments: {} });
      const n = firstNumber(textOf(r) || JSON.stringify(r));
      if (n !== null) addLedger(pf.id, 0, "Live balance sync", "live", n);
      return n;
    }
    if (pf.mode === "api" && pf.url && pf.balancePath) {
      const token = await decryptSecret(pf.tokenEnc);
      const r = await fetch(pf.url.replace(/\/$/, "") + pf.balancePath, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      const n = firstNumber(JSON.stringify(await r.json()));
      if (n !== null) addLedger(pf.id, 0, "Live balance sync", "live", n);
      return n;
    }
  } catch {
    return null;
  }
  return null;
}

/* ------------------------------ Credit router ------------------------------ */

export function routeLocal(model: ModelDef, mode: RouteMode, lockId: string, platforms: Platform[], duration = 5): RoutePlan {
  const alternatives = platforms
    .filter((pf) => pf.enabled && pf.models[model.id] !== undefined)
    .map((pf) => {
      const cost = Math.round(pf.models[model.id] * (model.kind === "video" ? Math.max(1, duration / 5) : 1));
      const ok = pf.balance - cost >= pf.threshold;
      return { platformId: pf.id, cost, ok, why: ok ? `${pf.balance} credits available` : `only ${pf.balance} credits (reserve ${pf.threshold})` };
    })
    .sort((a, b) => {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      if (a.cost !== b.cost) return a.cost - b.cost;
      const pa = platforms.find((x) => x.id === a.platformId)!;
      const pb = platforms.find((x) => x.id === b.platformId)!;
      return (pa.period === "daily" ? -1 : 0) - (pb.period === "daily" ? -1 : 0); // spend expiring daily credits first
    });
  const name = (id: string) => platforms.find((x) => x.id === id)?.name || id;
  if (mode === "lock" && lockId) {
    // "I choose": the person picked whose credits pay. Never switch to another platform behind their back.
    const pf = platforms.find((x) => x.id === lockId);
    const locked = alternatives.find((a) => a.platformId === lockId);
    if (locked?.ok) return { platformId: lockId, cost: locked.cost, reason: `You chose ${name(lockId)} (${locked.cost} cr)`, failover: false, alternatives };
    const blocked = !pf
      ? "The platform you chose no longer exists — pick another under “Pay with”."
      : !pf.enabled
        ? `${pf.name} is switched off in Settings — turn it on or pick another platform.`
        : !locked
          ? `${pf.name} doesn't offer ${model.name} — pick another model or platform.`
          : `${pf.name} has ${pf.balance} credits; this needs ${locked.cost} and you keep ${pf.threshold} in reserve — pick another platform or lower the reserve.`;
    return { platformId: null, cost: locked?.cost ?? estimateCost(model, duration), reason: blocked, failover: false, alternatives, blocked };
  }
  const best = alternatives.find((a) => a.ok);
  if (best) return { platformId: best.platformId, cost: best.cost, reason: `Cheapest available credit: ${name(best.platformId)} (${best.cost} cr)`, failover: false, alternatives };
  return { platformId: null, cost: estimateCost(model, duration), reason: alternatives.length ? "No linked platform has enough credits — using the model's own API key from the registry" : "No linked platform hosts this model — using the registry endpoint", failover: alternatives.length > 0, alternatives };
}

export async function planRoute(model: ModelDef, mode: RouteMode, lockId: string, duration = 5): Promise<RoutePlan> {
  const st = useStudio.getState();
  // refresh live balances first, where a platform exposes them
  await Promise.all(st.platforms.filter((p) => p.enabled && p.status === "connected").map(syncBalance));
  const fresh = useStudio.getState().platforms;
  const local = routeLocal(model, mode, lockId, fresh, duration);
  const t0 = performance.now();
  // a platform the person chose (or a blocked choice) needs no Claude call: there is nothing to decide
  if (claudeSource() === "none" || local.alternatives.length < 2 || mode === "lock" || local.blocked) {
    st.log({ task: `Credit router → ${model.name}`, mode: "local", model: "local engine", ms: Math.round(performance.now() - t0), ok: true, note: local.reason });
    return local;
  }
  try {
    const text =
      (await callClaude(
        'You are the Smart Credit & Capability Router of an AI film studio. Choose which connected platform should run this render. Respect the routing mode (cheapest = lowest cost with credits above reserve, prefer expiring daily credits; lock = use the locked platform unless it lacks credits, then fail over; preflight = cheapest). Reply JSON only: {"platformId": string|null, "reason": string}.',
        JSON.stringify({ model: model.name, mode, lockId, candidates: local.alternatives.map((a) => ({ ...a, platform: fresh.find((p) => p.id === a.platformId)?.name, features: fresh.find((p) => p.id === a.platformId)?.features })) }),
        300,
      )) || "";
    const pick = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    const alt = local.alternatives.find((a) => a.platformId === pick.platformId);
    st.log({ task: `Credit router → ${model.name}`, mode: "live", model: st.claudeModel, ms: Math.round(performance.now() - t0), ok: true, note: pick.reason });
    if (alt && alt.ok) return { ...local, platformId: alt.platformId, cost: alt.cost, reason: pick.reason, failover: local.failover };
    return local;
  } catch (e) {
    st.log({ task: `Credit router → ${model.name}`, mode: "local", model: "local engine", ms: Math.round(performance.now() - t0), ok: false, note: `Claude unavailable: ${e instanceof Error ? e.message : e}` });
    return local;
  }
}

/** Run a render through a platform. Returns the asset URL or marks the result as a preview. */
export async function executeOnPlatform(pf: Platform, model: ModelDef, controls: Record<string, unknown>, payload: unknown, cost: number, onLine?: (l: string) => void): Promise<{ url?: string; simulated: boolean }> {
  const st = useStudio.getState();
  let url: string | undefined;
  let simulated = true;
  if (st.liveRenders && pf.status === "connected") {
    if (pf.adapter || detectAdapter(pf)) {
      // a built-in adapter knows this platform's real inputs and how to fetch the finished file
      const c = controls as { prompt?: string; aspect_ratio?: string; duration?: number; resolution?: string };
      url = await renderOn(
        pf,
        { modelId: model.id, kind: model.kind, prompt: String(c.prompt || ""), aspect: c.aspect_ratio || "16:9", duration: Number(c.duration) || 5, resolution: c.resolution, maxCredits: Math.ceil(cost * 1.5) + 5 },
        onLine,
      );
      simulated = false;
    } else if (pf.mode === "mcp-remote" || pf.mode === "mcp-stdio") {
      const tool = pf.tools.find((t) => t.role === "generate" && (model.kind === "image" ? /image|imagine/.test(t.name) : /video|clip|generate/.test(t.name))) || pf.tools.find((t) => t.role === "generate");
      if (!tool) throw new Error(`${pf.name} exposes no generation tool`);
      onLine?.(`tools/call ${tool.name}`);
      const r = await mcpRpc(pf, "tools/call", { name: tool.name, arguments: { model: model.name, ...controls } });
      url = firstUrl(textOf(r) || JSON.stringify(r));
      simulated = false;
    } else if (pf.mode === "cli") {
      const out = await runCli(pf, { ...controls, model: model.id, out: `${uid("render")}.${model.kind === "image" ? "png" : "mp4"}` }, onLine);
      url = out.files[0] ? `${st.bridgeUrl}/files/${encodeURIComponent(out.files[0])}` : firstUrl(out.stdout);
      simulated = false;
    } else {
      url = await apiJob(pf, payload, onLine);
      simulated = false;
    }
  } else {
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 700));
  }
  // live balance after the render when available, otherwise deduct the estimate in the manual ledger
  const live = !simulated ? await syncBalance(useStudio.getState().platforms.find((x) => x.id === pf.id)!) : null;
  // previews spend nothing, so they leave the wallet alone; real renders use the live balance, or deduct the estimate when there is none
  if (live === null && !simulated) addLedger(pf.id, -cost, `${model.name} render`, "estimate");
  return { url, simulated };
}

/* ------------------------------ Pre-flight ------------------------------ */

export interface PreflightLine {
  label: string;
  model: ModelDef;
  plan: RoutePlan;
}

export function preflightSummary(lines: PreflightLine[], platforms: Platform[]) {
  const by: Record<string, { n: number; cost: number }> = {};
  lines.forEach((l) => {
    const k = l.plan.platformId || "registry";
    by[k] = by[k] || { n: 0, cost: 0 };
    by[k].n++;
    by[k].cost += l.plan.cost;
  });
  const parts = Object.entries(by).map(([k, v]) => `${v.n} ${v.n === 1 ? "shot" : "shots"} via ${k === "registry" ? "direct model APIs" : platforms.find((p) => p.id === k)?.name} (${v.cost} cr)`);
  const total = lines.reduce((a, l) => a + l.plan.cost, 0);
  return { parts, total, by };
}

/* ------------------------------ Add-any-platform wizard ------------------------------ */

export function platformFromPaste(text: string): Partial<Platform> {
  const t = text.trim();
  const url = (t.match(/https?:\/\/[^\s"'`]+/) || [])[0] || "";
  const lower = t.toLowerCase();
  if (/mcpservers/.test(lower)) {
    let name = "Local MCP server";
    try {
      const j = JSON.parse(t);
      name = Object.keys(j.mcpServers || {})[0] || name;
    } catch {
      /* not JSON */
    }
    return { name, mode: "mcp-stdio", mcpConfig: t };
  }
  if (/^curl\s/i.test(t) || /\bcurl\b/.test(lower)) {
    const path = url ? new URL(url).pathname : "/";
    const base = url ? new URL(url).origin : "";
    const keys = Array.from(new Set((t.match(/"([a-z_]+)"\s*:/gi) || []).map((k) => k.replace(/[":\s]/g, ""))));
    return { name: base.replace(/^https?:\/\/(api\.)?/, "").split(".")[0] || "API platform", mode: "api", url: base, submitPath: path, pollPath: `${path}/{id}`, assetPath: "output.url", note: `cURL keys: ${keys.join(", ")}` };
  }
  if (/usage:|options:|--help|flags:/.test(lower)) {
    const cmd = (t.match(/usage:\s*([\w.-]+)/i) || [])[1] || "platform-cli";
    const flags = Array.from(new Set(t.match(/--[a-z][\w-]*/gi) || []));
    const want = (re: RegExp, ph: string) => {
      const f = flags.find((x) => re.test(x));
      return f ? `${f} {${ph}}` : "";
    };
    const tpl = ["generate", want(/model/, "model"), want(/prompt|text/, "prompt"), want(/aspect|ratio|ar$/, "aspect_ratio"), want(/duration|seconds|length/, "duration"), want(/seed/, "seed"), want(/out|output|dest/, "out")].filter(Boolean).join(" ");
    return { name: cmd.replace(/-cli$/, ""), mode: "cli", command: cmd, argTemplate: tpl, note: `Found ${flags.length} flags` };
  }
  if (url) return { name: new URL(url).hostname.split(".").slice(-2, -1)[0] || "MCP platform", mode: "mcp-remote", url };
  return { name: "New platform", mode: "api" };
}

export function bridgeModule(pf: Partial<Platform>) {
  const name = (pf.name || "platform").replace(/\W+/g, "_");
  if (pf.mode === "cli")
    return `// ${pf.name} CLI bridge (generated)
import { spawn } from "node:child_process";
export async function generate_${name}(controls) {
  const args = ${JSON.stringify(toArgv(pf.argTemplate || ""))}.map(a => a.replace(/\\{(\\w+)\\}/g, (_, k) => String(controls[k] ?? "")));
  return new Promise((resolve, reject) => {
    const p = spawn(${JSON.stringify(pf.command)}, args, { shell: false });
    let out = ""; p.stdout.on("data", d => out += d); p.stderr.on("data", d => out += d);
    p.on("close", code => code === 0 ? resolve(out) : reject(new Error(out)));
  });
}
export const creditRules = ${JSON.stringify({ source: "manual", allotment: pf.allotment || 0, period: pf.period || "monthly" })};`;
  if (pf.mode === "api")
    return `// ${pf.name} API bridge (generated): submit_job -> poll_status -> fetch_asset_url
export async function submit_job(payload, token) {
  const r = await fetch(${JSON.stringify((pf.url || "") + (pf.submitPath || ""))}, { method: "POST", headers: { "content-type": "application/json", authorization: \`Bearer \${token}\` }, body: JSON.stringify(payload) });
  return (await r.json()).id;
}
export async function poll_status(id, token) {
  const r = await fetch(${JSON.stringify((pf.url || "") + (pf.pollPath || ""))}.replace("{id}", id), { headers: { authorization: \`Bearer \${token}\` } });
  return r.json();
}
export const fetch_asset_url = (job) => ${JSON.stringify(pf.assetPath || "output.url")}.split(".").reduce((o, k) => o?.[k], job);`;
  return `// ${pf.name} MCP bridge (generated)
export const server = ${JSON.stringify(pf.mode === "mcp-stdio" ? pf.mcpConfig : { url: pf.url, transport: "streamable-http", auth: "oauth2.1 / bearer" })};
// discovery: initialize -> notifications/initialized -> tools/list
// balance tool: ${pf.balancePath || "auto-detect (balance|credit|wallet)"}`;
}

export async function claudePlatformWizard(text: string): Promise<{ draft: Partial<Platform>; mode: "live" | "local" }> {
  const st = useStudio.getState();
  const local = platformFromPaste(text);
  const t0 = performance.now();
  if (claudeSource() === "none") {
    st.log({ task: "Platform wizard", mode: "local", model: "local engine", ms: 0, ok: true, note: "No Claude set up (no bridge or API key)" });
    return { draft: { ...local, bridgeCode: bridgeModule(local) }, mode: "local" };
  }
  try {
    const out =
      (await callClaude(
          'You connect creative platforms to an AI film studio. From a CLI --help dump, an MCP server URL/config or a cURL snippet, reply JSON only: {"name":string,"mode":"mcp-remote"|"mcp-stdio"|"cli"|"api","url":string,"mcpConfig":string,"command":string,"argTemplate":string (flags using {model} {prompt} {aspect_ratio} {duration} {seed} {out}),"submitPath":string,"pollPath":string (use {id}),"assetPath":string,"balancePath":string,"period":"monthly"|"daily","features":[string],"bridgeCode":string (a TypeScript module implementing the bridge and exporting creditRules)}',
        text.slice(0, 20000),
        2500,
      )) || "";
    const draft = JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1));
    st.log({ task: "Platform wizard", mode: "live", model: st.claudeModel, ms: Math.round(performance.now() - t0), ok: true });
    return { draft, mode: "live" };
  } catch (e) {
    st.log({ task: "Platform wizard", mode: "local", model: "local engine", ms: Math.round(performance.now() - t0), ok: false, note: String(e) });
    return { draft: { ...local, bridgeCode: bridgeModule(local) }, mode: "local" };
  }
}
