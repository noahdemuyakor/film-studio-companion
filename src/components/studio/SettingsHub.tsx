"use client";
import { useState } from "react";
import { useStudio } from "@/lib/store";
import { CLAUDE_MODELS, testClaude } from "@/lib/engine";
import { encryptSecret, maskSecret } from "@/lib/secure";
import { addLedger, bridgeHealth, bridgeModule, claudePlatformWizard, mcpDiscover, syncBalance } from "@/lib/bridge";
import { detectAdapter, flickCreateProject, flickProjects, pixmaxCanvas, pixmaxProjects, pixmaxStatus, syncCatalog } from "@/lib/adapters";
import { MODE_LABEL } from "@/lib/platforms";
import type { BridgeMode, Platform } from "@/lib/types";
import { uid } from "@/lib/util";
import { Brain, Plus, Rerun, Trash } from "../Icons";
import { Badge, Input, Modal, Select, TextArea } from "../ui";
import { useHydrated } from "../Hydrate";

function EngineCard() {
  const st = useStudio();
  const [key, setKey] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <section id="engine" className="rounded-16 bg-[#262d32] border border-w5 p-5">
      <div className="flex items-center gap-2">
        <Brain size={18} />
        <h2 className="text-20 font-semibold">Claude Power Engine</h2>
        <Badge tone={st.claudeKeyEnc || st.bridgeTokenEnc ? "lime" : "gray"}>
          {st.claudeKeyEnc ? "live · API key" : st.bridgeTokenEnc ? "live · Claude Code sign-in" : "local engine"}
        </Badge>
      </div>
      <p className="mt-2 text-14 text-w60 max-w-[760px]">
        Claude runs the Showrunner breakdowns, the Optical Prompt Compiler, the Continuity Guardian, the adapter generator and the credit router. It runs on
        your Claude sign-in through Claude Code on this computer: start the <a href="#bridge" className="text-lime">local bridge</a> and save its token below, no
        API key needed. An API key, if you save one here, is used instead (encrypted on this device, sent only to Anthropic). With neither, a local rule-based engine stands in.
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_280px_auto_auto] gap-2 items-end">
        <label className="text-12">
          <span className="text-w50 font-semibold">Anthropic API key (optional) — {maskSecret(st.claudeKeyEnc)}</span>
          <Input type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk-ant-…" />
        </label>
        <label className="text-12">
          <span className="text-w50 font-semibold">Model</span>
          <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
            <Select label="Claude model" value={st.claudeModel} onChange={(v) => st.set({ claudeModel: v })} options={CLAUDE_MODELS} />
          </div>
        </label>
        <button
          onClick={async () => {
            st.set({ claudeKeyEnc: key ? await encryptSecret(key) : "" });
            setKey("");
            setMsg(key ? "Key saved (encrypted)." : "Key removed.");
          }}
          className="h-9 px-4 rounded-8 bg-lime text-dark text-14 font-semibold"
        >
          {key ? "Save key" : "Clear key"}
        </button>
        <button
          onClick={async () => {
            setMsg("Testing…");
            try {
              setMsg(await testClaude());
            } catch (e) {
              setMsg(e instanceof Error ? e.message : String(e));
            }
          }}
          className="h-9 px-4 rounded-8 bg-w10 text-14 font-semibold"
        >
          Test
        </button>
      </div>
      {msg && <p className="mt-2 text-12 text-lime">{msg}</p>}
      <div className="mt-5">
        <p className="text-12 text-w50 font-semibold mb-2">Engine activity</p>
        <ul className="max-h-[220px] overflow-y-auto thin-scroll flex flex-col gap-1">
          {st.logs.length === 0 && <li className="text-12 text-w40">Nothing yet — generate a shot or run a breakdown.</li>}
          {st.logs.map((l) => (
            <li key={l.id} className="text-12 flex items-center gap-2 rounded-8 bg-w5 px-2 py-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${l.ok ? "bg-lime" : "bg-pink"}`} />
              <span className="font-semibold">{l.task}</span>
              <span className="text-w50">{l.mode === "live" ? l.model : "local engine"}</span>
              <span className="text-w40 truncate flex-1">{l.note}</span>
              <span className="text-w40 tabular-nums">{l.ms} ms</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** What the platform's render adapter needs: Flick project, ImagineArt organization, Google Flow's open project. */
function AdapterSetup({ p, patch }: { p: Platform; patch: (x: Partial<Platform>) => void }) {
  const [projects, setProjects] = useState<{ id: string; name: string }[] | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const run = async (label: string, f: () => Promise<void>) => {
    setBusy(label);
    setErr("");
    try {
      await f();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy("");
  };
  const count = Object.keys(p.nativeModels || {}).length;
  const kinds = Object.values(p.nativeModels || {}).reduce((a, m) => ({ ...a, [m.kind]: (a[m.kind] || 0) + 1 }), {} as Record<string, number>);
  return (
    <div className="rounded-10 bg-w5 p-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Badge tone="lime">real renders</Badge>
        <span className="text-w60 flex-1">
          {count} models · {kinds.image || 0} image · {kinds.video || 0} video
        </span>
        <button disabled={!!busy} onClick={() => run("models", async () => void (await syncCatalog(p)))} className="h-6 px-2 rounded-6 bg-w10 font-semibold disabled:opacity-50">
          {busy === "models" ? "Loading…" : "Refresh models"}
        </button>
      </div>
      {p.adapter === "flick" && (
        <div className="flex items-center gap-1.5">
          <span className="text-w50 shrink-0">Renders go to</span>
          {projects ? (
            <div className="h-7 flex-1 rounded-6 bg-w10 px-2 flex items-center">
              <Select
                label="Flick project"
                value={p.adapterConfig?.projectId || ""}
                onChange={(v) => {
                  if (v === "__new")
                    return run("new", async () => {
                      const n = await flickCreateProject(p, "Film Studio Companion");
                      setProjects([n, ...(projects || [])]);
                      patch({ adapterConfig: { ...p.adapterConfig, projectId: n.id, projectName: n.name } });
                    });
                  patch({ adapterConfig: { ...p.adapterConfig, projectId: v, projectName: projects.find((x) => x.id === v)?.name } });
                }}
                options={[{ id: "", label: "Choose a Flick project…" }, ...projects.map((x) => ({ id: x.id, label: x.name })), { id: "__new", label: "+ New project “Film Studio Companion”" }]}
                className="text-12"
              />
            </div>
          ) : (
            <button disabled={!!busy} onClick={() => run("projects", async () => setProjects(await flickProjects(p)))} className="h-7 flex-1 rounded-6 bg-w10 px-2 text-left font-semibold disabled:opacity-50">
              {busy === "projects" ? "Loading projects…" : p.adapterConfig?.projectName || "Choose a Flick project…"}
            </button>
          )}
        </div>
      )}
      {p.adapter === "pixmax" && (
        <div className="flex items-center gap-1.5">
          <span className="text-w50 shrink-0">Renders go to</span>
          {projects ? (
            <div className="h-7 flex-1 rounded-6 bg-w10 px-2 flex items-center">
              <Select
                label="Pixmax project"
                value={projects.find((x) => x.name === p.adapterConfig?.projectName)?.id || ""}
                onChange={(v) =>
                  run("canvas", async () => {
                    const file = await pixmaxCanvas(v);
                    patch({ adapterConfig: { ...p.adapterConfig, projectId: file, projectName: projects.find((x) => x.id === v)?.name } });
                  })
                }
                options={[{ id: "", label: "Choose a Pixmax project…" }, ...projects.map((x) => ({ id: x.id, label: x.name }))]}
                className="text-12"
              />
            </div>
          ) : (
            <button disabled={!!busy} onClick={() => run("projects", async () => setProjects(await pixmaxProjects()))} className="h-7 flex-1 rounded-6 bg-w10 px-2 text-left font-semibold disabled:opacity-50">
              {busy === "projects" ? "Loading projects…" : busy === "canvas" ? "Opening canvas…" : p.adapterConfig?.projectName || "Choose a Pixmax project…"}
            </button>
          )}
        </div>
      )}
      {p.adapter === "imagineart" && <p className="text-w50">Organization: {p.adapterConfig?.orgId ? "chosen" : "picked automatically on the first render (you have one)"}.</p>}
      {p.adapter === "flow" && <p className="text-w50">Open a project in the Google Flow Chrome window before rendering. Images cost 0 credits; files are shared through the bridge.</p>}
      {p.adapter === "openart" && <p className="text-w50">Renders go to your default OpenArt project. Each one is price-checked before it starts.</p>}
      {err && <p className="text-[#ff5c9a]">{err}</p>}
    </div>
  );
}

function PlatformCard({ p }: { p: Platform }) {
  const st = useStudio();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const patch = (x: Partial<Platform>) => st.update("platforms", (v) => v.map((q) => (q.id === p.id ? { ...q, ...x } : q)));
  const connect = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (token) patch({ tokenEnc: await encryptSecret(token) });
      if (p.mode === "mcp-remote" || p.mode === "mcp-stdio") {
        const fresh = { ...useStudio.getState().platforms.find((q) => q.id === p.id)! };
        const tools = await mcpDiscover(fresh);
        patch({ tools, status: "connected", note: `${tools.length} tools discovered`, balanceSource: tools.some((t) => t.role === "balance") ? "live" : "manual" });
        const n = await syncBalance({ ...fresh, tools, status: "connected" });
        // platforms with a built-in adapter: load every model they offer, with real prices
        let models = 0;
        if (detectAdapter({ tools })) {
          models = await syncCatalog({ ...useStudio.getState().platforms.find((q) => q.id === p.id)!, tools, status: "connected" });
          const cur = useStudio.getState().platforms.find((q) => q.id === p.id)!;
          if (cur.adapter === "flick" && !cur.adapterConfig?.projectId) {
            const mine = (await flickProjects(cur)).find((x) => /film studio companion/i.test(x.name));
            if (mine) patch({ adapterConfig: { ...cur.adapterConfig, projectId: mine.id, projectName: mine.name } });
          }
        }
        setMsg(`Connected · ${tools.length} tools${models ? ` · ${models} models` : ""}${n !== null ? ` · live balance ${n}` : ""}`);
      } else if (p.mode === "cli" && detectAdapter(p) === "pixmax") {
        const s = await pixmaxStatus();
        if (!s.loggedIn) throw new Error("Pixmax CLI isn't signed in — run: pixmax auth login web");
        patch({ status: "connected", adapter: "pixmax", note: `Signed in as ${s.name || "you"}${s.tier ? ` (${s.tier.toLowerCase()})` : ""}` });
        setMsg("Loading Pixmax models (about a minute)…");
        const n = await syncCatalog({ ...useStudio.getState().platforms.find((q) => q.id === p.id)!, status: "connected" });
        setMsg(`Connected · ${n} models`);
      } else if (p.mode === "cli") {
        setMsg(await bridgeHealth());
        patch({ status: "connected", note: "CLI reachable through the local bridge" });
      } else {
        if (!p.url) throw new Error("Add the API base URL first");
        const n = await syncBalance(useStudio.getState().platforms.find((q) => q.id === p.id)!);
        patch({ status: "connected", balanceSource: n !== null ? "live" : "manual", note: n !== null ? "Live balance available" : "Manual ledger (no balance endpoint)" });
        setMsg(n !== null ? `Live balance ${n}` : "Saved. No balance endpoint, so the manual ledger tracks spend.");
      }
      setToken("");
    } catch (e) {
      patch({ status: "error", note: e instanceof Error ? e.message : String(e) });
      setMsg(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };
  return (
    <article className="rounded-16 bg-[#262d32] border border-w5 p-4 flex flex-col gap-3 text-12">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${p.status === "connected" ? "bg-lime" : p.status === "error" ? "bg-pink" : "bg-w30"}`} />
        <h3 className="text-16 font-semibold flex-1">{p.name}</h3>
        <label className="flex items-center gap-1">
          <input type="checkbox" className="accent-[#8db600]" checked={p.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> On
        </label>
        <button aria-label={`Remove ${p.name}`} onClick={() => st.update("platforms", (v) => v.filter((q) => q.id !== p.id))} className="text-w40">
          <Trash size={12} />
        </button>
      </div>
      <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
        <Select label="Connection mode" value={p.mode} onChange={(v) => patch({ mode: v as BridgeMode, status: "disconnected" })} options={Object.entries(MODE_LABEL).map(([id, label]) => ({ id, label }))} />
      </div>
      {p.mode === "mcp-remote" && <Input value={p.url} onChange={(e) => patch({ url: e.target.value })} placeholder="MCP server URL (Streamable HTTP / SSE)" />}
      {p.mode === "mcp-stdio" && <TextArea value={p.mcpConfig} onChange={(e) => patch({ mcpConfig: e.target.value })} rows={4} className="font-mono text-[11px]" placeholder={'{ "mcpServers": { "openart": { "command": "npx", "args": ["-y", "openart-mcp"], "env": { "OPENART_API_KEY": "…" } } } }'} />}
      {p.mode === "cli" && (
        <>
          <Input value={p.command} onChange={(e) => patch({ command: e.target.value })} placeholder="CLI executable, e.g. pixmax-cli" />
          <Input value={p.argTemplate} onChange={(e) => patch({ argTemplate: e.target.value })} className="font-mono text-[11px]" placeholder="generate --model {model} --prompt {prompt} --out {out}" />
        </>
      )}
      {p.mode === "api" && (
        <div className="grid grid-cols-2 gap-1.5">
          <Input value={p.url} onChange={(e) => patch({ url: e.target.value })} placeholder="API base URL" className="col-span-2" />
          <Input value={p.submitPath} onChange={(e) => patch({ submitPath: e.target.value })} placeholder="submit_job path" />
          <Input value={p.pollPath} onChange={(e) => patch({ pollPath: e.target.value })} placeholder="poll_status path {id}" />
          <Input value={p.assetPath} onChange={(e) => patch({ assetPath: e.target.value })} placeholder="asset URL path" />
          <Input value={p.balancePath} onChange={(e) => patch({ balancePath: e.target.value })} placeholder="balance path (optional)" />
        </div>
      )}
      {p.mode !== "cli" && (
        <Input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder={`API key, bearer / OAuth token or session cookie — ${maskSecret(p.tokenEnc)}`} />
      )}
      <div className="grid grid-cols-3 gap-1.5 items-end">
        <label>
          <span className="text-w50">Balance</span>
          <Input type="number" value={p.balance} onChange={(e) => addLedger(p.id, 0, "Manual correction", "manual", Number(e.target.value))} />
        </label>
        <label>
          <span className="text-w50">{p.period === "daily" ? "Daily" : "Monthly"} allotment</span>
          <Input type="number" value={p.allotment} onChange={(e) => patch({ allotment: Number(e.target.value), sample: false })} />
        </label>
        <label>
          <span className="text-w50">Keep reserve</span>
          <Input type="number" value={p.threshold} onChange={(e) => patch({ threshold: Number(e.target.value) })} />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={p.balanceSource === "live" ? "lime" : "gray"}>{p.balanceSource === "live" ? "live balance" : "manual ledger"}</Badge>
        {p.sample && <Badge tone="pink">sample numbers — enter yours</Badge>}
        <div className="h-7 rounded-6 bg-w5 px-2 flex items-center w-[110px]">
          <Select label="Period" value={p.period} onChange={(v) => patch({ period: v as Platform["period"] })} options={["monthly", "daily"]} className="text-12" />
        </div>
        <button onClick={() => addLedger(p.id, 0, `${p.period} reset`, "manual", p.allotment)} className="h-7 px-2 rounded-6 bg-w5 font-semibold flex items-center gap-1">
          <Rerun size={10} /> Reset to allotment
        </button>
      </div>
      {p.adapter && <AdapterSetup p={p} patch={patch} />}
      <button onClick={() => setOpen(!open)} className="text-left text-w50">
        {open ? "▾" : "▸"} Models on this platform ({Object.keys(p.models).length}) · features ({p.features.length}) · tools ({p.tools.length})
      </button>
      {open && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[1fr_80px] gap-1">
            {st.models
              .filter((m) => m.kind !== "audio" && (!p.adapter || p.models[m.id] !== undefined))
              .map((m) => (
                <label key={m.id} className="contents">
                  <span className="flex items-center gap-1.5">
                    <input type="checkbox" className="accent-[#8db600]" checked={p.models[m.id] !== undefined} onChange={(e) => patch({ models: e.target.checked ? { ...p.models, [m.id]: m.cost } : Object.fromEntries(Object.entries(p.models).filter(([k]) => k !== m.id)) })} />
                    {m.name}
                  </span>
                  <input aria-label={`Credits for ${m.name}`} type="number" disabled={p.models[m.id] === undefined} value={p.models[m.id] ?? ""} onChange={(e) => patch({ models: { ...p.models, [m.id]: Number(e.target.value) } })} className="h-6 rounded-6 bg-w5 px-1.5 outline-none disabled:opacity-30" />
                </label>
              ))}
          </div>
          <Input value={p.features.join(", ")} onChange={(e) => patch({ features: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Proprietary features (comma separated)" />
          {p.tools.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {p.tools.map((t) => (
                <li key={t.name} title={t.description} className="rounded-6 bg-w5 px-1.5 py-0.5 text-[10px]">
                  {t.name} <span className="text-w40">{t.role}</span>
                </li>
              ))}
            </ul>
          )}
          {p.bridgeCode && <pre className="font-mono text-[10px] leading-4 text-w60 bg-black/30 rounded-8 p-2 max-h-[160px] overflow-auto thin-scroll whitespace-pre-wrap">{p.bridgeCode}</pre>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <button disabled={busy} onClick={connect} className="h-8 px-3 rounded-8 bg-lime text-dark font-semibold disabled:opacity-50">
          {busy ? "Connecting…" : p.mode.startsWith("mcp") ? "Connect & discover tools" : "Connect & sync"}
        </button>
        <span className="text-w50 truncate">{msg || p.note}</span>
      </div>
    </article>
  );
}

function Wizard({ onClose }: { onClose: () => void }) {
  const update = useStudio((s) => s.update);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal open title="Add any platform" onClose={onClose} width={720}>
      <p className="text-14 text-w60">Paste a CLI&apos;s --help output, an MCP server URL or mcpServers JSON block, or a cURL snippet. Claude writes the bridge module and registers the platform&apos;s credit rules in your wallet.</p>
      <TextArea value={text} onChange={(e) => setText(e.target.value)} rows={12} className="mt-3 font-mono text-12" placeholder={"Usage: pixverse-cli [options]\n  --model <name>\n  --prompt <text>\n  --aspect-ratio <ratio>\n  --duration <sec>\n  --output <file>"} />
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="h-10 px-4 rounded-8 bg-w10 text-14 font-semibold">
          Cancel
        </button>
        <button
          disabled={busy || !text.trim()}
          onClick={async () => {
            setBusy(true);
            const { draft } = await claudePlatformWizard(text);
            const pf: Platform = {
              id: uid("pf"),
              name: draft.name || "New platform",
              mode: (draft.mode as BridgeMode) || "api",
              enabled: true,
              url: draft.url || "",
              mcpConfig: draft.mcpConfig || "",
              command: draft.command || "",
              argTemplate: draft.argTemplate || "",
              submitPath: draft.submitPath || "",
              pollPath: draft.pollPath || "",
              assetPath: draft.assetPath || "",
              balancePath: draft.balancePath || "",
              balance: 0,
              balanceSource: "manual",
              allotment: 0,
              period: (draft.period as Platform["period"]) || "monthly",
              threshold: 0,
              models: {},
              features: draft.features || [],
              tools: [],
              status: "disconnected",
              note: draft.note,
              bridgeCode: draft.bridgeCode || bridgeModule(draft),
            };
            update("platforms", (v) => [...v, pf]);
            setBusy(false);
            onClose();
          }}
          className="h-10 px-4 rounded-8 bg-lime text-dark-2 text-14 font-semibold disabled:opacity-50"
        >
          {busy ? "Claude is reading it…" : "Build bridge"}
        </button>
      </div>
    </Modal>
  );
}

function BridgeCard() {
  const st = useStudio();
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <section id="bridge" className="rounded-16 bg-[#262d32] border border-w5 p-5 text-14">
      <h2 className="text-20 font-semibold">Local bridge (CLI + local MCP servers)</h2>
      <p className="mt-2 text-w60 max-w-[820px]">
        A web page can&apos;t start programs on your computer, so CLI tools and stdio MCP servers run through a small companion program that ships in the project&apos;s
        <code className="mx-1 text-white">bridge</code> folder. Start it with <code className="text-lime">node bridge/fsc-bridge.mjs</code>, paste the token it prints, and list the
        commands it may run in <code className="text-white">bridge/allowed.json</code>. It only listens on 127.0.0.1 and never runs a shell.
      </p>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-end text-12">
        <label>
          <span className="text-w50 font-semibold">Bridge URL</span>
          <Input value={st.bridgeUrl} onChange={(e) => st.set({ bridgeUrl: e.target.value })} />
        </label>
        <label>
          <span className="text-w50 font-semibold">Bridge token — {maskSecret(st.bridgeTokenEnc)}</span>
          <Input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="printed when the bridge starts" />
        </label>
        <button
          onClick={async () => {
            if (token) st.set({ bridgeTokenEnc: await encryptSecret(token) });
            setToken("");
            try {
              setMsg(await bridgeHealth());
            } catch (e) {
              setMsg(`Not reachable: ${e instanceof Error ? e.message : e}`);
            }
          }}
          className="h-9 px-4 rounded-8 bg-lime text-dark text-14 font-semibold"
        >
          Save & check
        </button>
      </div>
      {msg && <p className="mt-2 text-12 text-lime">{msg}</p>}
    </section>
  );
}

export default function SettingsHub() {
  const hydrated = useHydrated();
  const platforms = useStudio((s) => s.platforms);
  const ledger = useStudio((s) => s.ledger);
  const [wizard, setWizard] = useState(false);
  if (!hydrated) return <div className="h-[60vh] grid place-items-center text-w40">Loading settings…</div>;
  const total = platforms.filter((p) => p.enabled).reduce((a, p) => a + p.balance, 0);
  return (
    <div className="max-w-app mx-auto px-4 py-8 flex flex-col gap-6">
      <h1 className="font-display font-bold uppercase text-40 leading-[48px]">Settings</h1>
      <EngineCard />
      <section id="platforms">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <h2 className="text-20 font-semibold">Connected Platforms & Wallets</h2>
            <p className="text-14 text-w60 mt-1">Use credits you already have elsewhere. Each platform connects by MCP, CLI or API; the credit router picks the cheapest one with enough balance and fails over automatically.</p>
          </div>
          <div className="rounded-12 bg-w5 px-4 h-10 flex items-center gap-2 text-14">
            Wallet total <b className="text-lime tabular-nums">{total.toLocaleString()} cr</b>
          </div>
          <button onClick={() => setWizard(true)} className="btn-lime h-10 px-4 rounded-10 text-14 font-semibold flex items-center gap-2">
            <Plus size={14} /> Add any platform
          </button>
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {platforms.map((p) => (
            <PlatformCard key={p.id} p={p} />
          ))}
        </div>
      </section>
      <section className="rounded-16 bg-[#262d32] border border-w5 p-5">
        <h2 className="text-20 font-semibold">Credit ledger</h2>
        <table className="mt-3 w-full text-12">
          <thead className="text-w50 text-left">
            <tr>
              <th className="font-medium py-1">When</th>
              <th className="font-medium">Platform</th>
              <th className="font-medium">What</th>
              <th className="font-medium">Source</th>
              <th className="font-medium text-right">Change</th>
              <th className="font-medium text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-w40">
                  No spend yet. Every render deducts its estimate here, or syncs the live balance where the platform reports one.
                </td>
              </tr>
            )}
            {ledger.slice(0, 60).map((l) => (
              <tr key={l.id} className="border-t border-w5">
                <td className="py-1.5 text-w50">{new Date(l.at).toLocaleString()}</td>
                <td>{platforms.find((p) => p.id === l.platformId)?.name}</td>
                <td>{l.reason}</td>
                <td className="text-w50">{l.source}</td>
                <td className={`text-right tabular-nums ${l.delta < 0 ? "text-[#ff5c9a]" : "text-lime"}`}>{l.delta > 0 ? `+${l.delta}` : l.delta}</td>
                <td className="text-right tabular-nums">{l.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <BridgeCard />
      {wizard && <Wizard onClose={() => setWizard(false)} />}
    </div>
  );
}
