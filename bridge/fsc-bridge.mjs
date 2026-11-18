#!/usr/bin/env node
/**
 * Film Studio Companion — local bridge.
 *
 * The studio is a static web app, so it cannot start programs on your computer by itself.
 * Run this small helper to let it:
 *   - run authenticated creative CLIs you already have installed (pixmax-cli, gcloud, …)
 *   - talk to local stdio MCP servers defined in an "mcpServers" config block
 *   - serve the files those tools download, so they land on your timeline
 *   - run the Claude Power Engine through Claude Code, on your Claude sign-in (POST /claude)
 *
 * Start:   node bridge/fsc-bridge.mjs            (optional: PORT=4317 FSC_BRIDGE_TOKEN=…)
 * Then paste the printed token into Settings → Local bridge.
 *
 * Safety: listens on 127.0.0.1 only, requires the token on every request, only runs commands
 * listed in bridge/allowed.json, and never uses a shell (arguments are passed as an array).
 * No dependencies — plain Node.js 18+.
 */
import http from "node:http";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const VERSION = "1.0.0";
const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 4317);
const TOKEN = process.env.FSC_BRIDGE_TOKEN || randomBytes(18).toString("base64url");
const CONFIG_FILE = join(HERE, "allowed.json");
const config = existsSync(CONFIG_FILE) ? JSON.parse(readFileSync(CONFIG_FILE, "utf8")) : { commands: [], outputDir: "./bridge-output" };
const OUT = resolve(HERE, config.outputDir || "./bridge-output");
mkdirSync(OUT, { recursive: true });
const allowed = new Set(config.commands || []);

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type, x-bridge-token",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-private-network": "true",
};

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "content-type": type, ...cors });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((ok, fail) => {
    let s = "";
    req.on("data", (d) => {
      s += d;
      if (s.length > 40e6) fail(new Error("body too large"));
    });
    req.on("end", () => {
      try {
        ok(s ? JSON.parse(s) : {});
      } catch (e) {
        fail(e);
      }
    });
  });
}

function listFiles(dir) {
  try {
    return readdirSync(dir).map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }));
  } catch {
    return [];
  }
}

/* ----------------------------- CLI runner ----------------------------- */
function runCli(req, res, body) {
  const { command, args = [], cwdName = "default" } = body;
  if (!allowed.has(command)) return send(res, 403, { error: `"${command}" is not in bridge/allowed.json` });
  if (!Array.isArray(args) || args.some((a) => typeof a !== "string")) return send(res, 400, { error: "args must be an array of strings" });
  const cwd = join(OUT, basename(String(cwdName)));
  mkdirSync(cwd, { recursive: true });
  const before = new Set(listFiles(cwd).map((x) => x.f));
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", ...cors });
  const emit = (ev) => res.write(`data: ${JSON.stringify(ev)}\n\n`);
  const child = spawn(command, args, { cwd, shell: false, env: process.env });
  child.stdout.on("data", (d) => emit({ type: "stdout", text: String(d) }));
  child.stderr.on("data", (d) => emit({ type: "stderr", text: String(d) }));
  child.on("error", (e) => {
    emit({ type: "stderr", text: String(e.message) });
    emit({ type: "exit", code: -1, files: [] });
    res.end();
  });
  child.on("close", (code) => {
    const files = listFiles(cwd)
      .filter((x) => !before.has(x.f))
      .sort((a, b) => b.t - a.t)
      .map((x) => `${basename(cwd)}/${x.f}`);
    emit({ type: "exit", code, files });
    res.end();
  });
  req.on("close", () => child.exitCode === null && child.kill());
}

/* ------------------- Claude Power Engine via Claude Code ------------------- */
// Runs `claude -p` so the studio uses your Claude Code sign-in (Pro/Max plan) instead of an API key.
// Override the program with FSC_CLAUDE_BIN. Tools, MCP servers, skills and settings files are all off:
// the call is plain text in, text out.
const HOME = process.env.USERPROFILE || process.env.HOME || "";
const CLAUDE_BIN =
  process.env.FSC_CLAUDE_BIN ||
  [join(HOME, ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude")].find((p) => existsSync(p)) ||
  "claude";
const CLAUDE_CWD = join(OUT, "claude-engine");
mkdirSync(CLAUDE_CWD, { recursive: true });

function runClaude(res, body) {
  const { system = "", user = "", model = "" } = body;
  if (typeof system !== "string" || typeof user !== "string") return send(res, 400, { error: "system and user must be strings" });
  if (model && !/^[a-z0-9][a-z0-9.\-]{1,60}$/i.test(model)) return send(res, 400, { error: "bad model name" });
  const args = ["-p", "--output-format", "json", "--no-session-persistence", "--tools", "", "--strict-mcp-config", "--setting-sources", "", "--disable-slash-commands"];
  if (system) args.push("--system-prompt", system);
  if (model) args.push("--model", model);
  const child = spawn(CLAUDE_BIN, args, { cwd: CLAUDE_CWD, shell: false, env: process.env });
  let out = "";
  let err = "";
  let done = false;
  const finish = (code, payload) => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    send(res, code, payload);
  };
  const timer = setTimeout(() => {
    child.kill();
    finish(504, { error: "Claude Code took longer than 5 minutes" });
  }, 300000);
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("error", (e) => finish(500, { error: `Couldn't start Claude Code (${CLAUDE_BIN}): ${e.message}` }));
  child.on("close", (code) => {
    let j;
    try {
      j = JSON.parse(out);
    } catch {
      return finish(502, { error: (err || out || `claude exited with ${code}`).trim().slice(0, 400) });
    }
    if (j.is_error) return finish(502, { error: String(j.result || j.subtype || "Claude Code error").slice(0, 400) });
    finish(200, { text: String(j.result ?? ""), model: model || "default", ms: j.duration_ms });
  });
  child.stdin.end(user);
}

/* ------------------- local media (e.g. Google Flow downloads) ------------------- */
// Tools like flow-mcp save results as files on this computer. The studio can only show a URL, so a file
// inside one of allowed.json's "mediaRoots" is copied into the served output folder under a random name.
const MEDIA_ROOTS = (config.mediaRoots || []).map((r) => resolve(String(r).replace(/^~(?=$|[\\/])/, HOME)));
const MEDIA_EXT = /\.(png|jpe?g|webp|gif|mp4|mov|webm|m4a|mp3|wav)$/i;
function importMedia(res, body) {
  const p = resolve(String(body.path || ""));
  const inRoot = MEDIA_ROOTS.some((r) => p.toLowerCase().startsWith((r.endsWith(sep) ? r : r + sep).toLowerCase()));
  if (!inRoot) return send(res, 403, { error: `Only files under mediaRoots in bridge/allowed.json can be shared (${MEDIA_ROOTS.join(", ") || "none set"})` });
  if (!MEDIA_EXT.test(p)) return send(res, 400, { error: "Only image, video and audio files can be shared" });
  if (!existsSync(p)) return send(res, 404, { error: "File not found" });
  const dir = join(OUT, "imports");
  mkdirSync(dir, { recursive: true });
  const name = `${randomBytes(9).toString("base64url")}-${basename(p).replace(/[^\w.-]+/g, "_")}`;
  copyFileSync(p, join(dir, name));
  send(res, 200, { file: `imports/${name}` });
}

/* ---------------------- reference images for platforms ---------------------- */
// References reach platforms in different ways: some take a local file path (Google Flow, Pixmax uploads),
// some take bytes (ImagineArt upload, OpenArt signed PUT). The page may only hold a data: URL or a web URL
// (which the browser can't always fetch across origins), so the bridge turns either into bytes or a file.
const REFS = join(OUT, "refs");
mkdirSync(REFS, { recursive: true });
const MAX_REF = 25 * 1024 * 1024;
async function refBytes(src) {
  const s = String(src || "");
  const m = s.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (m) {
    const buf = m[2] ? Buffer.from(m[3], "base64") : Buffer.from(decodeURIComponent(m[3]));
    return { buf, type: m[1] || "application/octet-stream" };
  }
  if (!/^https:\/\//i.test(s)) throw new Error("Only data: or https: images can be used as references");
  const r = await fetch(s, { redirect: "follow" });
  if (!r.ok) throw new Error(`Couldn't download the reference (${r.status})`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { buf, type: (r.headers.get("content-type") || "application/octet-stream").split(";")[0] };
}
const extOf = (type, src) => ({ "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif", "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov" })[type] || (String(src).match(/\.(png|jpe?g|webp|gif|mp4|webm|mov)(\?|$)/i)?.[0].replace("?", "") ?? ".bin");
async function refRoute(res, url, body) {
  const { buf, type } = await refBytes(body.src);
  if (buf.length > MAX_REF) return send(res, 413, { error: "Reference is larger than 25 MB" });
  if (!/^(image|video)\//.test(type)) return send(res, 400, { error: `Not an image or video (${type})` });
  if (url === "/media/save") {
    const p = join(REFS, `${randomBytes(9).toString("base64url")}${extOf(type, body.src)}`);
    writeFileSync(p, buf);
    return send(res, 200, { path: p, type, size: buf.length });
  }
  if (url === "/media/bytes") return send(res, 200, { base64: buf.toString("base64"), type, size: buf.length });
  if (url === "/media/put") {
    // presigned upload (OpenArt): only https URLs, bytes exactly as given
    if (!/^https:\/\//i.test(String(body.signUrl || ""))) return send(res, 400, { error: "signUrl must be https" });
    const r = await fetch(body.signUrl, { method: "PUT", headers: { "content-type": body.contentType || type }, body: buf });
    return send(res, r.ok ? 200 : 502, r.ok ? { ok: true, size: buf.length, type } : { error: `Upload refused (${r.status}): ${(await r.text()).slice(0, 200)}` });
  }
  send(res, 404, { error: "unknown route" });
}

/* ------------------------------- Pixmax ------------------------------- */
// The Pixmax CLI (pixmax.cmd -> python launcher.py) can't be spawned without a shell, so the bridge runs its
// launcher directly. Only these fixed, read-only or generate commands are reachable: no free-form arguments.
function findPixmax() {
  const roots = [join(process.env.APPDATA || "", "Python"), join(HOME, "AppData", "Roaming", "Python")];
  for (const r of roots) {
    if (!existsSync(r)) continue;
    for (const d of readdirSync(r)) {
      const cmd = join(r, d, "Scripts", "pixmax.cmd");
      if (!existsSync(cmd)) continue;
      const t = readFileSync(cmd, "utf8");
      const home = t.match(/PIXMAX_CLI_HOME=([^"\r\n]+)/)?.[1];
      const run = t.match(/"([^"]+python[^"]*\.exe)"\s+"([^"]+launcher\.py)"/i);
      if (!run) continue;
      // Run the active runtime's entry.py directly: the launcher re-executes itself with os.execv, which on
      // Windows drops the quoting, so any argument with a space (every prompt) would be split into words.
      let launcher = run[2];
      try {
        const cur = JSON.parse(readFileSync(join(home || dirname(dirname(run[2])), "runtime", "current.json"), "utf8"));
        const entry = join(home || dirname(dirname(run[2])), cur.runtimeDir, "entry.py");
        if (existsSync(entry)) launcher = entry;
      } catch {
        /* fall back to the launcher */
      }
      return { python: run[1], launcher, home };
    }
  }
  return null;
}
const PIXMAX = findPixmax();
const pmText = (v, max = 4000) => String(v ?? "").slice(0, max);
const pmSafe = (v) => /^[A-Za-z0-9_.:-]{1,64}$/.test(String(v ?? ""));
function runPixmax(res, body) {
  if (!PIXMAX) return send(res, 404, { error: "Pixmax CLI not found. Install it from console.pixmax.ai/cli and run: pixmax auth login web" });
  const a = body.action;
  let args;
  if (a === "status") args = ["--json", "auth", "login", "status"];
  else if (a === "projects") args = ["--json", "project", "list"];
  else if (a === "files" && pmSafe(body.project)) args = ["--json", "project", "files", "--project", body.project];
  else if (a === "models" && /^GENERATE_(IMAGE|VIDEO)$/.test(body.type)) args = ["--json", "model", "search", "--type", body.type];
  else if (a === "upload" && pmSafe(body.file) && typeof body.path === "string" && resolve(body.path).startsWith(REFS + sep) && existsSync(body.path))
    args = ["--json", "assets", "upload", resolve(body.path), "--file-uuid", body.file, "--as-node", `FSC ref ${randomBytes(3).toString("hex")}`, "--x", "0", "--y", String(400 + Math.floor(Math.random() * 400))];
  else if (a === "explain" && /^GENERATE_(IMAGE|VIDEO)$/.test(body.type) && pmSafe(body.model)) args = ["--json", "model", "explain", body.model, "--type", body.type];
  else if ((a === "image" || a === "video") && body.prompt && pmSafe(body.file) && (!body.model || pmSafe(body.model))) {
    const label = `FSC ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    // with a reference node (an uploaded image on the canvas): edit from it / animate it
    const ref = /^[0-9a-f-]{36}$/i.test(String(body.refNode || "")) ? body.refNode : "";
    args =
      a === "image"
        ? ref ? ["--json", "image", "edit", label, "--image-node", ref] : ["--json", "image", "generate", label]
        : ref ? ["--json", "video", "image-to-video", label, "--image-node", ref] : ["--json", "video", "text-to-video", label];
    args.push("--file", body.file, "--prompt", pmText(body.prompt));
    if (body.model) args.push("--model", body.model);
    if (pmSafe(body.aspect)) args.push("--aspect-ratio", body.aspect);
    if (pmSafe(body.resolution)) args.push("--resolution", body.resolution);
    if (a === "video" && pmSafe(body.duration)) args.push("--duration", String(body.duration));
    // the model's other required settings (e.g. quality), filled from its own defaults by the studio
    for (const [k, v] of Object.entries(body.extra && typeof body.extra === "object" ? body.extra : {}))
      if (/^[A-Za-z][A-Za-z0-9_.]{0,40}$/.test(k) && /^[\w.:-]{1,40}$/.test(String(v))) args.push("-s", `${k}=${v}`);
    if (a === "image") args.push("--run");
    args.push("--allow-failed", "--timeout", "1500");
  } else return send(res, 400, { error: "Unsupported Pixmax request" });
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", ...(PIXMAX.home ? { PIXMAX_CLI_HOME: PIXMAX.home } : {}) };
  const child = spawn(PIXMAX.python, [PIXMAX.launcher, ...args], { shell: false, env, cwd: OUT });
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => (out += d));
  child.stderr.on("data", (d) => (err += d));
  child.on("error", (e) => send(res, 500, { error: e.message }));
  child.on("close", (code) => {
    let json = null;
    try {
      json = JSON.parse(out);
    } catch {
      const m = out.match(/\{[\s\S]*\}\s*$/);
      try {
        json = m ? JSON.parse(m[0]) : null;
      } catch {}
    }
    if (code !== 0 && !json) return send(res, 502, { error: (err || out || `pixmax exited with ${code}`).trim().slice(0, 600) });
    send(res, 200, { code, result: json, raw: json ? undefined : out.slice(0, 4000) });
  });
}

/* ----------------------------- stdio MCP ----------------------------- */
const servers = new Map(); // id -> { child, pending: Map, buf }

function startServer(id, configText) {
  const cfg = JSON.parse(configText || "{}");
  const entries = Object.entries(cfg.mcpServers || {});
  if (!entries.length) throw new Error("mcpServers block is empty");
  const [, def] = entries[0];
  if (!allowed.has(def.command)) throw new Error(`"${def.command}" is not in bridge/allowed.json`);
  const child = spawn(def.command, def.args || [], { shell: false, env: { ...process.env, ...(def.env || {}) } });
  const s = { child, pending: new Map(), buf: "", nextId: 1 };
  child.stdout.on("data", (d) => {
    s.buf += String(d);
    let i;
    while ((i = s.buf.indexOf("\n")) >= 0) {
      const line = s.buf.slice(0, i).trim();
      s.buf = s.buf.slice(i + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        const p = s.pending.get(msg.id);
        if (p) {
          s.pending.delete(msg.id);
          msg.error ? p.fail(new Error(msg.error.message || "MCP error")) : p.ok(msg.result);
        }
      } catch {
        /* server log line */
      }
    }
  });
  child.stderr.on("data", (d) => process.stderr.write(`[mcp ${id}] ${d}`));
  child.on("close", () => servers.delete(id));
  servers.set(id, s);
  return s;
}

function rpc(s, method, params) {
  if (method.startsWith("notifications/")) {
    s.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
    return Promise.resolve(null);
  }
  const id = s.nextId++;
  return new Promise((ok, fail) => {
    s.pending.set(id, { ok, fail });
    s.child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => s.pending.has(id) && (s.pending.delete(id), fail(new Error("MCP server timed out"))), 120000);
  });
}

/* ----------------------------- server ----------------------------- */
// one bad request must never take the whole bridge down: log it and keep serving
process.on("unhandledRejection", (e) => console.error("[bridge] request failed:", e instanceof Error ? e.message : e));
process.on("uncaughtException", (e) => console.error("[bridge] error:", e instanceof Error ? e.message : e));
http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (req.headers["x-bridge-token"] !== TOKEN && !req.url.startsWith("/files/")) return send(res, 401, { error: "bad or missing x-bridge-token" });
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, version: VERSION, allowed: [...allowed], outputDir: OUT, claude: CLAUDE_BIN, pixmax: !!PIXMAX });
      if (req.method === "POST" && req.url === "/cli/run") return runCli(req, res, await readBody(req));
      if (req.method === "POST" && req.url === "/claude") return runClaude(res, await readBody(req));
      if (req.method === "POST" && req.url === "/media/import") return importMedia(res, await readBody(req));
      if (req.method === "POST" && req.url === "/pixmax") return runPixmax(res, await readBody(req));
      if (req.method === "POST" && ["/media/save", "/media/bytes", "/media/put"].includes(req.url)) return await refRoute(res, req.url, await readBody(req));
      const m = req.url.match(/^\/mcp\/([^/]+)\/rpc$/);
      if (req.method === "POST" && m) {
        const body = await readBody(req);
        const id = decodeURIComponent(m[1]);
        const s = servers.get(id) || startServer(id, body.config);
        return send(res, 200, { result: await rpc(s, body.method, body.params || {}) });
      }
      const f = req.url.match(/^\/files\/(.+)$/);
      if (req.method === "GET" && f) {
        const p = resolve(OUT, decodeURIComponent(f[1]));
        if (!p.startsWith(OUT) || !existsSync(p)) return send(res, 404, { error: "not found" });
        res.writeHead(200, { ...cors });
        return createReadStream(p).pipe(res);
      }
      send(res, 404, { error: "unknown route" });
    } catch (e) {
      send(res, 500, { error: String(e.message || e) });
    }
  })
  .listen(PORT, "127.0.0.1", () => {
    console.log(`Film Studio Companion bridge v${VERSION} on http://127.0.0.1:${PORT}`);
    console.log(`Token (paste into Settings → Local bridge): ${TOKEN}`);
    console.log(`Allowed commands: ${[...allowed].join(", ") || "(none — edit bridge/allowed.json)"}`);
    console.log(`Claude Power Engine: Claude Code at ${CLAUDE_BIN} (your Claude sign-in, no API key needed)`);
  });
