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
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
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
      if (s.length > 5e6) fail(new Error("body too large"));
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
http
  .createServer(async (req, res) => {
    if (req.method === "OPTIONS") return send(res, 204, "");
    if (req.headers["x-bridge-token"] !== TOKEN && !req.url.startsWith("/files/")) return send(res, 401, { error: "bad or missing x-bridge-token" });
    try {
      if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, version: VERSION, allowed: [...allowed], outputDir: OUT, claude: CLAUDE_BIN });
      if (req.method === "POST" && req.url === "/cli/run") return runCli(req, res, await readBody(req));
      if (req.method === "POST" && req.url === "/claude") return runClaude(res, await readBody(req));
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
