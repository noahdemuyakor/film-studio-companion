"use client";
import { useMemo, useState } from "react";
import { useStudio } from "@/lib/store";
import { APP_PARAMS, CAPABILITIES, PROVIDERS, type AppParam, type ModelDef } from "@/lib/types";
import { buildPayload, estimateCost } from "@/lib/router";
import { adapterCode, generateAdapter } from "@/lib/engine";
import { encryptSecret, maskSecret } from "@/lib/secure";
import { uid } from "@/lib/util";
import { Brain, Plus, Settings, Trash } from "../Icons";
import { Badge, Input, Modal, Select, TextArea } from "../ui";
import { useHydrated } from "../Hydrate";

const SAMPLE_CONTROLS = {
  prompt: "Maya walks the pier at golden hour, anamorphic 35mm, slow dolly in",
  negative_prompt: "blurry, watermark",
  aspect_ratio: "9:16",
  duration: 6,
  resolution: "1080p",
  cfg_scale: 6.5,
  seed: 4242,
  reference_urls: ["https://example.com/ref/maya.jpg"],
  first_frame_url: "https://example.com/frames/shot1-last.jpg",
  last_frame_url: undefined,
  audio: true,
};

const blank = (): ModelDef => ({
  id: uid("model"),
  name: "",
  vendor: "Custom",
  kind: "video",
  provider: "rest",
  endpoint: "",
  method: "POST",
  capabilities: ["t2v"],
  paramMap: { prompt: "prompt", aspect_ratio: "aspect_ratio", duration: "duration", seed: "seed" },
  staticParams: "{}",
  responsePath: "video.url",
  cost: 10,
  costPerSecond: 3,
  tier: "draft",
  promptStyle: "prose",
  maxDuration: 10,
  enabled: true,
  builtin: false,
  blurb: "",
});

function ModelModal({ initial, onClose }: { initial: ModelDef | null; onClose: () => void }) {
  const update = useStudio((s) => s.update);
  const [m, setM] = useState<ModelDef>(initial || blank());
  const [tab, setTab] = useState<"form" | "docs">(initial ? "form" : "form");
  const [key, setKey] = useState("");
  const [docs, setDocs] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [dur, setDur] = useState(6);
  const set = (p: Partial<ModelDef>) => setM((x) => ({ ...x, ...p }));
  const payload = useMemo(() => {
    try {
      return JSON.stringify(buildPayload(m, SAMPLE_CONTROLS), null, 2);
    } catch (e) {
      return String(e);
    }
  }, [m]);
  const save = async () => {
    const apiKeyEnc = key ? await encryptSecret(key) : m.apiKeyEnc;
    const final = { ...m, apiKeyEnc, name: m.name || "Untitled model", adapterCode: m.adapterCode || adapterCode(m) };
    update("models", (list) => (list.some((x) => x.id === final.id) ? list.map((x) => (x.id === final.id ? final : x)) : [...list, final]));
    onClose();
  };
  const fromDocs = async () => {
    setBusy(true);
    const r = await generateAdapter(docs);
    set({ ...r.value, id: m.id, builtin: false, enabled: true } as Partial<ModelDef>);
    setNote(`${r.mode === "live" ? "Claude" : "Local parser"} wrote the adapter${r.note ? ` (${r.note})` : ""}. Review the mapping, then save.`);
    setTab("form");
    setBusy(false);
  };
  return (
    <Modal open title={initial ? `Edit ${initial.name}` : "Register a model"} onClose={onClose} width={980}>
      <div className="flex gap-1 p-0.5 rounded-8 bg-w5 w-fit mb-4">
        <button onClick={() => setTab("form")} className={`h-8 px-3 rounded-6 text-12 font-semibold ${tab === "form" ? "bg-w10" : "text-w50"}`}>
          Manual setup
        </button>
        <button onClick={() => setTab("docs")} className={`h-8 px-3 rounded-6 text-12 font-semibold flex items-center gap-1.5 ${tab === "docs" ? "bg-w10" : "text-w50"}`}>
          <Brain size={12} /> Paste API docs (zero-code)
        </button>
      </div>
      {tab === "docs" ? (
        <div className="flex flex-col gap-3">
          <p className="text-14 text-w60">Paste the model&apos;s API documentation (endpoint, request body, response example). Claude reads it and writes the request/response adapter.</p>
          <TextArea value={docs} onChange={(e) => setDocs(e.target.value)} rows={14} className="font-mono text-12" placeholder={'POST https://api.example.ai/v1/video\n{\n  "prompt": "...",\n  "aspect_ratio": "16:9",\n  "duration": 5,\n  "image_url": "https://...",\n  "seed": 1\n}\nResponse: { "video": { "url": "https://..." } }'} />
          <button disabled={busy || !docs.trim()} onClick={fromDocs} className="btn-lime self-start h-10 px-4 rounded-10 text-14 font-semibold disabled:opacity-50">
            {busy ? "Reading docs…" : "Generate adapter"}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="flex flex-col gap-3 text-12">
            {note && <p className="rounded-8 bg-[#8db6001a] text-lime p-2">{note}</p>}
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-w50 font-semibold">Model name</span>
                <Input value={m.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Kling 4.0 Master" />
              </label>
              <label>
                <span className="text-w50 font-semibold">Type</span>
                <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
                  <Select label="Type" value={m.kind} onChange={(v) => set({ kind: v as ModelDef["kind"] })} options={["video", "image", "audio"]} />
                </div>
              </label>
              <label>
                <span className="text-w50 font-semibold">Provider</span>
                <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
                  <Select label="Provider" value={m.provider} onChange={(v) => set({ provider: v as ModelDef["provider"] })} options={PROVIDERS.map((p) => ({ id: p.id, label: p.label }))} />
                </div>
              </label>
              <label>
                <span className="text-w50 font-semibold">Tier</span>
                <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
                  <Select label="Tier" value={m.tier} onChange={(v) => set({ tier: v as ModelDef["tier"] })} options={[{ id: "draft", label: "Draft (cheap)" }, { id: "final", label: "Final render" }]} />
                </div>
              </label>
            </div>
            <label>
              <span className="text-w50 font-semibold">Endpoint URL</span>
              <Input value={m.endpoint} onChange={(e) => set({ endpoint: e.target.value })} placeholder="https://…" />
            </label>
            <label>
              <span className="text-w50 font-semibold">API key / bearer token — {maskSecret(m.apiKeyEnc)}</span>
              <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Stored encrypted on this device" autoComplete="off" />
            </label>
            <div>
              <span className="text-w50 font-semibold">Capabilities</span>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {CAPABILITIES.map((c) => (
                  <label key={c.id} className="flex items-center gap-2">
                    <input type="checkbox" className="accent-[#8db600]" checked={m.capabilities.includes(c.id)} onChange={(e) => set({ capabilities: e.target.checked ? [...m.capabilities, c.id] : m.capabilities.filter((x) => x !== c.id) })} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-w50 font-semibold">Parameter schema mapper (app control → payload key, dot paths allowed)</span>
              <div className="mt-1 grid grid-cols-[130px_1fr] gap-1 items-center">
                {APP_PARAMS.map((p) => (
                  <div key={p} className="contents">
                    <span className="font-mono text-w60">{p}</span>
                    <input aria-label={`Payload key for ${p}`} value={m.paramMap[p as AppParam] || ""} onChange={(e) => set({ paramMap: { ...m.paramMap, [p]: e.target.value || undefined } })} placeholder="not sent" className="h-7 rounded-6 bg-w5 px-2 font-mono outline-none" />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label>
                <span className="text-w50 font-semibold">Response URL path</span>
                <Input value={m.responsePath} onChange={(e) => set({ responsePath: e.target.value })} className="font-mono" />
              </label>
              <label>
                <span className="text-w50 font-semibold">Prompt syntax</span>
                <div className="h-9 rounded-8 bg-w5 px-3 flex items-center">
                  <Select label="Prompt syntax" value={m.promptStyle} onChange={(v) => set({ promptStyle: v as ModelDef["promptStyle"] })} options={[{ id: "prose", label: "Cinematic prose" }, { id: "tags", label: "Descriptor tags" }, { id: "timecoded", label: "Timecoded beats" }, { id: "weighted", label: "Weighted + negative" }, { id: "mj", label: "Midjourney flags" }]} />
                </div>
              </label>
            </div>
            <label>
              <span className="text-w50 font-semibold">Fixed payload fields (JSON)</span>
              <TextArea value={m.staticParams} onChange={(e) => set({ staticParams: e.target.value })} rows={2} className="font-mono text-12" />
            </label>
          </div>
          <div className="flex flex-col gap-3 text-12">
            <div className="rounded-12 bg-w5 p-3">
              <p className="font-semibold">Credit / cost estimator</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label>
                  <span className="text-w50">Base credits</span>
                  <Input type="number" value={m.cost} onChange={(e) => set({ cost: Number(e.target.value) })} />
                </label>
                <label>
                  <span className="text-w50">Per second</span>
                  <Input type="number" value={m.costPerSecond} onChange={(e) => set({ costPerSecond: Number(e.target.value) })} />
                </label>
                <label>
                  <span className="text-w50">Max seconds</span>
                  <Input type="number" value={m.maxDuration} onChange={(e) => set({ maxDuration: Number(e.target.value) })} />
                </label>
              </div>
              <label className="mt-2 flex items-center gap-2">
                <span className="text-w50">Shot length {dur}s</span>
                <input type="range" min={1} max={30} value={dur} onChange={(e) => setDur(Number(e.target.value))} className="flex-1 accent-[#8db600]" />
              </label>
              <p className="mt-1">
                One generation ≈ <b className="text-lime">{estimateCost(m, dur)} credits</b>. A 10-take draft pass then 2 final takes ≈ {estimateCost(m, dur) * (m.tier === "draft" ? 10 : 2)} credits on this model.
              </p>
            </div>
            <div className="rounded-12 bg-black/30 p-3">
              <p className="font-semibold mb-1">Payload preview (sample shot)</p>
              <pre className="font-mono text-[11px] leading-4 text-w60 whitespace-pre-wrap max-h-[220px] overflow-auto thin-scroll">{payload}</pre>
            </div>
            <div className="rounded-12 bg-black/30 p-3">
              <p className="font-semibold mb-1">Adapter code</p>
              <pre className="font-mono text-[11px] leading-4 text-w60 whitespace-pre-wrap max-h-[200px] overflow-auto thin-scroll">{m.adapterCode || adapterCode(m)}</pre>
            </div>
            <div className="flex justify-end gap-2 mt-auto">
              <button onClick={onClose} className="h-10 px-4 rounded-8 bg-w10 text-14 font-semibold">
                Cancel
              </button>
              <button onClick={save} className="h-10 px-4 rounded-8 bg-lime text-dark-2 text-14 font-semibold">
                Save to registry
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function ModelHub() {
  const hydrated = useHydrated();
  const models = useStudio((s) => s.models);
  const update = useStudio((s) => s.update);
  const liveRenders = useStudio((s) => s.liveRenders);
  const set = useStudio((s) => s.set);
  const [edit, setEdit] = useState<ModelDef | null | "new">(null);
  if (!hydrated) return <div className="h-[60vh] grid place-items-center text-w40">Loading registry…</div>;
  const groups: [string, ModelDef[]][] = [
    ["Video models", models.filter((m) => m.kind === "video")],
    ["Image models", models.filter((m) => m.kind === "image")],
    ["Audio models", models.filter((m) => m.kind === "audio")],
  ];
  return (
    <div className="max-w-app mx-auto px-4 py-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px]">
          <h1 className="font-display font-bold uppercase text-40 leading-[48px]">Model Hub</h1>
          <p className="text-14 text-w60 mt-1">Bring your own model: register any image or video API, map its parameters, and hot-swap it into any shot or canvas node.</p>
        </div>
        <label className="flex items-center gap-2 text-12 rounded-10 bg-w5 h-10 px-3">
          <input type="checkbox" className="accent-[#8db600]" checked={liveRenders} onChange={(e) => set({ liveRenders: e.target.checked })} />
          Live renders (call real endpoints when a key is set)
        </label>
        <button onClick={() => setEdit("new")} className="btn-lime h-10 px-4 rounded-10 text-14 font-semibold flex items-center gap-2">
          <Plus size={14} /> Add model
        </button>
      </div>
      {groups.map(([title, list]) => (
        <section key={title} className="mt-8">
          <h2 className="text-16 font-semibold mb-3">{title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {list.map((m) => (
              <article key={m.id} className={`rounded-16 border border-w5 bg-[#262d32] p-4 flex flex-col gap-2 ${m.enabled ? "" : "opacity-50"}`}>
                <div className="flex items-center gap-2">
                  <h3 className="text-16 font-semibold flex-1 truncate">{m.name}</h3>
                  <Badge tone={m.tier === "draft" ? "gray" : "lime"}>{m.tier}</Badge>
                </div>
                <p className="text-12 text-w50">
                  {m.vendor} · {PROVIDERS.find((p) => p.id === m.provider)?.label} · {m.apiKeyEnc ? "key saved" : "no key"}
                </p>
                <p className="text-12 text-w60 min-h-8">{m.blurb}</p>
                <div className="flex flex-wrap gap-1">
                  {m.capabilities.map((c) => (
                    <span key={c} className="text-[10px] rounded-6 bg-w5 px-1.5 py-0.5 text-w60">
                      {CAPABILITIES.find((x) => x.id === c)?.label}
                    </span>
                  ))}
                </div>
                <div className="mt-auto flex items-center gap-2 pt-2 text-12">
                  <span className="text-w50">~{estimateCost(m, 5)} cr / 5s</span>
                  <label className="ml-auto flex items-center gap-1">
                    <input type="checkbox" className="accent-[#8db600]" checked={m.enabled} onChange={(e) => update("models", (v) => v.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)))} /> On
                  </label>
                  <button aria-label={`Configure ${m.name}`} onClick={() => setEdit(m)} className="w-8 h-8 rounded-8 bg-w5 grid place-items-center">
                    <Settings size={14} />
                  </button>
                  {!m.builtin && (
                    <button aria-label={`Remove ${m.name}`} onClick={() => update("models", (v) => v.filter((x) => x.id !== m.id))} className="w-8 h-8 rounded-8 bg-w5 grid place-items-center">
                      <Trash size={14} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
      {edit && <ModelModal initial={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
