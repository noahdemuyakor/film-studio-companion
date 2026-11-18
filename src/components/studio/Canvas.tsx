"use client";
import { useCallback, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChangeset,
  type Node,
  type NodeChangeset,
  type NodeProps,
} from "@xyflow/react";
import { modelById, useStudio } from "@/lib/store";
import { breakdownScript } from "@/lib/engine";
import { produceShot } from "@/lib/router";
import { estimateCost } from "@/lib/router";
import { LIGHTING } from "@/lib/presets";
import type { RouteMode, Shot } from "@/lib/types";
import { artGradient, uid } from "@/lib/util";
import { Brain, Camera, Film, Image as ImageIcon, Lock, Plus, Spark, Trash } from "../Icons";
import { Select } from "../ui";
import { Preview, RouteSelector } from "./shared";
import Timeline from "./Timeline";
import { useHydrated } from "../Hydrate";

type D = Record<string, unknown>;

function patchNode(id: string, data: D) {
  useStudio.getState().update("nodes", (ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
}

function Shell({ title, icon, color, children, id, inputs = true, outputs = true }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode; id: string; inputs?: boolean; outputs?: boolean }) {
  return (
    <div className="w-[300px] rounded-16 bg-[#262d32] border border-w10 shadow-2xl text-white">
      {inputs && <Handle type="target" position={Position.Left} style={{ background: color }} />}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-w5">
        <span className="w-5 h-5 rounded-6 grid place-items-center text-dark" style={{ background: color }}>
          {icon}
        </span>
        <span className="text-12 font-semibold flex-1 truncate">{title}</span>
        <button aria-label="Delete node" onClick={() => useStudio.getState().update("nodes", (ns) => ns.filter((n) => n.id !== id))} className="text-w40 hover:text-white nodrag">
          <Trash size={12} />
        </button>
      </div>
      <div className="p-3 flex flex-col gap-2 text-12">{children}</div>
      {outputs && <Handle type="source" position={Position.Right} style={{ background: color }} />}
    </div>
  );
}

function ScriptNode({ id, data }: NodeProps) {
  const cast = useStudio((s) => s.cast);
  const [busy, setBusy] = useState(false);
  const rf = useReactFlow();
  const breakdown = async () => {
    setBusy(true);
    const r = await breakdownScript(String(data.text || ""), cast);
    const self = rf.getNode(id)!;
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let prev = id;
    r.value.scenes.slice(0, 6).forEach((sc, i) => {
      const nid = uid("n");
      newNodes.push({ id: nid, type: "shot", position: { x: self.position.x + 380 + i * 360, y: self.position.y + 520 }, data: { title: sc.title, prompt: `${sc.shots[0]?.description || sc.summary}. Emotion: ${sc.emotion}.`, modelId: "wan-2-7", routeMode: "cheapest" } });
      newEdges.push({ id: uid("e"), source: prev, target: nid, animated: true, label: i === 0 ? "breakdown" : "last frame → first frame" });
      prev = nid;
    });
    useStudio.getState().update("nodes", (ns) => [...ns, ...newNodes]);
    useStudio.getState().update("edges", (es) => [...es, ...newEdges]);
    patchNode(id, { note: `${r.mode === "live" ? "Claude" : "Local engine"}: ${r.value.scenes.length} scenes → ${newNodes.length} shot nodes` });
    setBusy(false);
  };
  return (
    <Shell id={id} title="Script" icon={<Film size={11} />} color="#ffffff" inputs={false}>
      <textarea aria-label="Script text" value={String(data.text || "")} onChange={(e) => patchNode(id, { text: e.target.value })} className="nodrag nowheel w-full h-[150px] rounded-8 bg-w5 p-2 outline-none resize-none font-mono text-[11px] leading-4" />
      <button disabled={busy} onClick={breakdown} className="nodrag h-8 rounded-8 bg-lime text-dark font-semibold flex items-center justify-center gap-1.5">
        <Brain size={12} /> {busy ? "Breaking down…" : "Break down into shot nodes"}
      </button>
      {Boolean(data.note) && <p className="text-[11px] text-w50">{String(data.note)}</p>}
    </Shell>
  );
}

function CharacterNode({ id, data }: NodeProps) {
  const cast = useStudio((s) => s.cast);
  const c = cast.find((x) => x.id === data.castId) || cast[0];
  const w = c?.wardrobe.find((x) => x.id === c.activeWardrobe);
  return (
    <Shell id={id} title={`Character · ${c?.name || "—"}`} icon={<Camera size={11} />} color="#8db600" inputs={false}>
      <div className="rounded-8 bg-w5 px-2 h-8 flex items-center nodrag">
        <Select label="Cast member" value={String(data.castId || "")} onChange={(v) => patchNode(id, { castId: v })} options={cast.map((x) => ({ id: x.id, label: x.name }))} className="text-12" />
      </div>
      {c && (
        <>
          <p className="text-w60 leading-4">{c.face}</p>
          <p className="text-w40 leading-4">Wardrobe: {w?.description}</p>
          <p className="flex items-center gap-1 text-lime">{c.locked && <Lock size={10} />} Face anchor locked across scenes</p>
        </>
      )}
    </Shell>
  );
}

function LocationNode({ id, data }: NodeProps) {
  const vault = useStudio((s) => s.vault);
  const refs = vault.filter((r) => r.kind === "location" || r.kind === "style");
  const r = vault.find((x) => x.id === data.refId) || refs[0];
  return (
    <Shell id={id} title={`Style / Location · ${r?.name || "—"}`} icon={<ImageIcon size={11} />} color="#7cc4ff" inputs={false}>
      <div className="h-[70px] rounded-8" style={{ background: r?.dataUrl ? `center/cover url(${r.dataUrl})` : artGradient((r?.name.length || 3) * 31) }} />
      <div className="grid grid-cols-2 gap-1.5 nodrag">
        <div className="rounded-8 bg-w5 px-2 h-8 flex items-center">
          <Select label="Location" value={String(data.refId || "")} onChange={(v) => patchNode(id, { refId: v })} options={refs.map((x) => ({ id: x.id, label: x.name }))} className="text-12" />
        </div>
        <div className="rounded-8 bg-w5 px-2 h-8 flex items-center">
          <Select label="Lighting" value={String(data.lighting || "Golden Hour")} onChange={(v) => patchNode(id, { lighting: v })} options={LIGHTING} className="text-12" />
        </div>
      </div>
      <p className="text-w50 leading-4">{r?.description}</p>
    </Shell>
  );
}

function ReferenceNode({ id, data }: NodeProps) {
  const vault = useStudio((s) => s.vault);
  const r = vault.find((x) => x.id === data.refId);
  return (
    <Shell id={id} title={`Reference · ${r?.name || "pick one"}`} icon={<ImageIcon size={11} />} color="#ffb347" inputs={false}>
      <div className="rounded-8 bg-w5 px-2 h-8 flex items-center nodrag">
        <Select label="Vault item" value={String(data.refId || "")} onChange={(v) => patchNode(id, { refId: v })} options={[{ id: "", label: "Choose from vault…" }, ...vault.map((x) => ({ id: x.id, label: `${x.kind}: ${x.name}` }))]} className="text-12" />
      </div>
      {r && <div className="h-[80px] rounded-8" style={{ background: r.dataUrl ? `center/cover url(${r.dataUrl})` : artGradient(r.name.length * 17) }} />}
    </Shell>
  );
}

/** Collect anchors (cast, vault refs, lighting, previous shot) from everything wired into a node. */
function useAnchors(id: string) {
  const edges = useStudio((s) => s.edges);
  const nodes = useStudio((s) => s.nodes);
  return useMemo(() => {
    const incoming = edges.filter((e) => e.target === id).map((e) => nodes.find((n) => n.id === e.source)).filter(Boolean) as Node[];
    const castIds = incoming.filter((n) => n.type === "character").map((n) => String(n.data.castId));
    const refIds = incoming.filter((n) => n.type === "location" || n.type === "reference").map((n) => String(n.data.refId)).filter(Boolean);
    const lighting = incoming.find((n) => n.type === "location")?.data.lighting as string | undefined;
    const prevNode = incoming.find((n) => n.type === "shot");
    return { castIds, refIds, lighting, prevShot: prevNode?.data.shot as Shot | undefined, count: incoming.length };
  }, [edges, nodes, id]);
}

function ShotNode({ id, data }: NodeProps) {
  const st = useStudio();
  const a = useAnchors(id);
  const model = modelById(st.models, String(data.modelId || st.modelId));
  const shot = data.shot as Shot | undefined;
  const run = async () => {
    patchNode(id, { shot: { ...(shot || {}), status: "compiling", seed: 1, settings: st.settings } });
    const result = await produceShot(
      {
        title: String(data.title || "Shot"),
        prompt: String(data.prompt || ""),
        model,
        settings: { ...st.settings, lighting: a.lighting || st.settings.lighting },
        cast: st.cast.filter((c) => a.castIds.includes(c.id)),
        refs: st.vault.filter((r) => a.refIds.includes(r.id)),
        prev: a.prevShot,
        firstFrameUrl: a.prevShot?.resultUrl,
        routeMode: (data.routeMode as RouteMode) || "cheapest",
        lockId: String(data.lockId || ""),
      },
      (status, partial) => patchNode(id, { shot: { ...(shot || {}), ...partial, status, seed: 1, settings: st.settings } }),
    );
    patchNode(id, { shot: result });
  };
  const toTimeline = () => {
    if (!shot) return;
    st.update("clips", (clips) => {
      const end = clips.filter((c) => c.track === "video").reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      return [...clips, { id: uid("clip"), track: "video", start: end, duration: shot.settings.duration, label: String(data.title), shotId: shot.id, seed: shot.seed, transition: "cut", subtitle: String(data.prompt).split(/[.!?]/)[0], url: shot.resultUrl }];
    });
  };
  return (
    <Shell id={id} title={String(data.title || "Shot")} icon={<Spark size={11} />} color="#ff5c9a">
      <input aria-label="Shot title" value={String(data.title || "")} onChange={(e) => patchNode(id, { title: e.target.value })} className="nodrag h-7 rounded-6 bg-w5 px-2 outline-none font-semibold" />
      <textarea aria-label="Shot prompt" value={String(data.prompt || "")} onChange={(e) => patchNode(id, { prompt: e.target.value })} className="nodrag nowheel h-[60px] rounded-8 bg-w5 p-2 outline-none resize-none leading-4" />
      <div className="flex flex-wrap gap-1">
        {a.castIds.map((c) => (
          <span key={c} className="rounded-6 bg-[#8db6003d] text-lime px-1.5 py-0.5 text-[10px]">
            {st.cast.find((x) => x.id === c)?.name}
          </span>
        ))}
        {a.refIds.map((r) => (
          <span key={r} className="rounded-6 bg-[#7cc4ff33] text-[#7cc4ff] px-1.5 py-0.5 text-[10px]">
            {st.vault.find((x) => x.id === r)?.name}
          </span>
        ))}
        {a.prevShot && <span className="rounded-6 bg-[#ff5c9a33] text-[#ff5c9a] px-1.5 py-0.5 text-[10px]">first frame locked</span>}
        {!a.count && <span className="text-w40 text-[10px]">Drag a character or location into this node to pass anchors</span>}
      </div>
      <div className="rounded-8 bg-w5 px-2 h-8 flex items-center nodrag">
        <Select label="Model" value={model.id} onChange={(v) => patchNode(id, { modelId: v })} options={st.models.filter((m) => m.enabled && m.kind !== "audio").map((m) => ({ id: m.id, label: `${m.name} · ${m.tier}` }))} className="text-12" />
      </div>
      <div className="nodrag">
        <RouteSelector compact modelId={model.id} mode={(data.routeMode as RouteMode) || "cheapest"} lock={String(data.lockId || "")} onChange={(m, l) => patchNode(id, { routeMode: m, lockId: l })} />
      </div>
      {shot && shot.settings && <Preview shot={shot} />}
      {shot?.route && <p className="text-[10px] text-w40">{shot.route}</p>}
      <div className="flex gap-1.5 nodrag">
        <button onClick={run} className="flex-1 h-8 rounded-8 bg-lime text-dark font-semibold">
          Generate · {estimateCost(model, st.settings.duration)} cr
        </button>
        <button disabled={!shot || shot.status !== "done"} onClick={toTimeline} className="h-8 px-2 rounded-8 bg-w10 font-semibold disabled:opacity-40">
          → Timeline
        </button>
      </div>
    </Shell>
  );
}

function CompareNode({ id, data }: NodeProps) {
  const st = useStudio();
  const a = useAnchors(id);
  const ids = (data.modelIds as string[]) || [];
  const results = (data.results as Record<string, Shot>) || {};
  const run = async () => {
    await Promise.all(
      ids.map(async (mid) => {
        const model = modelById(st.models, mid);
        const r = await produceShot({ title: model.name, prompt: String(data.prompt || ""), model, settings: st.settings, cast: st.cast.filter((c) => a.castIds.includes(c.id)), refs: st.vault.filter((x) => a.refIds.includes(x.id)), routeMode: "cheapest" });
        const cur = (useStudio.getState().nodes.find((n) => n.id === id)?.data.results as Record<string, Shot>) || {};
        patchNode(id, { results: { ...cur, [mid]: r } });
      }),
    );
  };
  return (
    <div className="w-[560px]">
      <Shell id={id} title="Multi-model comparison" icon={<Spark size={11} />} color="#b28dff" outputs={false}>
        <textarea aria-label="Comparison prompt" value={String(data.prompt || "")} onChange={(e) => patchNode(id, { prompt: e.target.value })} className="nodrag nowheel h-[48px] rounded-8 bg-w5 p-2 outline-none resize-none" />
        <div className="flex flex-wrap gap-1 nodrag">
          {st.models
            .filter((m) => m.enabled && m.kind === "video")
            .map((m) => (
              <button key={m.id} onClick={() => patchNode(id, { modelIds: ids.includes(m.id) ? ids.filter((x) => x !== m.id) : [...ids, m.id].slice(0, 4) })} className={`h-6 px-2 rounded-6 text-[11px] font-semibold ${ids.includes(m.id) ? "bg-white text-dark" : "bg-w5 text-w60"}`}>
                {m.name} <span className="opacity-60">{m.tier === "draft" ? "draft" : "final"}</span>
              </button>
            ))}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(1, ids.length)}, minmax(0,1fr))` }}>
          {ids.map((mid) => {
            const m = modelById(st.models, mid);
            const r = results[mid];
            return (
              <div key={mid} className="flex flex-col gap-1">
                {r ? <Preview shot={r} /> : <div className="aspect-video rounded-12 bg-w5 grid place-items-center text-w40 text-[10px]">not run</div>}
                <p className="text-[11px] font-semibold truncate">{m.name}</p>
                <p className="text-[10px] text-w50">{r ? `${r.credits} cr` : `~${estimateCost(m, st.settings.duration)} cr`}</p>
              </div>
            );
          })}
        </div>
        <button onClick={run} className="nodrag h-8 rounded-8 bg-lime text-dark font-semibold">
          Run side by side
        </button>
      </Shell>
    </div>
  );
}

const nodeTypes = { script: ScriptNode, character: CharacterNode, location: LocationNode, reference: ReferenceNode, shot: ShotNode, compare: CompareNode };

function Board() {
  const nodes = useStudio((s) => s.nodes);
  const edges = useStudio((s) => s.edges);
  const update = useStudio((s) => s.update);
  const rf = useReactFlow();
  const onNodesChange = useCallback((c: NodeChangeset<Node>) => update("nodes", (ns) => c.applyTo(ns)), [update]);
  const onEdgesChange = useCallback((c: EdgeChangeset<Edge>) => update("edges", (es) => c.applyTo(es)), [update]);
  const onConnect = useCallback(
    (c: Connection) => {
      const src = useStudio.getState().nodes.find((n) => n.id === c.source);
      update("edges", (es) => addEdge({ ...c, animated: true, label: src?.type === "shot" ? "last frame → first frame" : undefined }, es));
    },
    [update],
  );
  const add = (type: string) => {
    const center = rf.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
    const st = useStudio.getState();
    const data: D =
      type === "character" ? { castId: st.cast[0]?.id } : type === "location" ? { refId: st.vault.find((r) => r.kind === "location")?.id, lighting: "Golden Hour" } : type === "shot" ? { title: "New shot", prompt: "", modelId: st.modelId } : type === "compare" ? { prompt: "", modelIds: ["omni-flash", "veo-3-1"] } : type === "script" ? { text: "" } : {};
    update("nodes", (ns) => [...ns, { id: uid("n"), type, position: { x: center.x + Math.random() * 60, y: center.y + Math.random() * 60 }, data }]);
  };
  return (
    <div className="relative flex-1 min-h-0">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.15} maxZoom={2} className="dark" proOptions={{ hideAttribution: true }}>
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#ffffff22" />
        <MiniMap pannable zoomable nodeColor={(n) => ({ script: "#fff", character: "#8db600", location: "#7cc4ff", reference: "#ffb347", shot: "#ff5c9a", compare: "#b28dff" })[n.type || ""] || "#888"} />
        <Controls />
      </ReactFlow>
      <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1.5 rounded-12 bg-[#262d32]/90 border border-w10 p-1.5 backdrop-blur">
        {[
          ["script", "Script"],
          ["character", "Character"],
          ["location", "Style / Location"],
          ["reference", "Reference"],
          ["shot", "Shot"],
          ["compare", "Compare models"],
        ].map(([t, l]) => (
          <button key={t} onClick={() => add(t)} className="h-8 px-2.5 rounded-8 bg-w5 hover:bg-w10 text-12 font-semibold flex items-center gap-1">
            <Plus size={12} /> {l}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Canvas() {
  const hydrated = useHydrated();
  return (
    <div className="flex flex-col h-[calc(100vh-52px)] md:h-[calc(100vh-36px)]">
      <h1 className="sr-only">Infinite node canvas</h1>
      {hydrated ? (
        <ReactFlowProvider>
          <Board />
        </ReactFlowProvider>
      ) : (
        <div className="flex-1 grid place-items-center text-w40">Loading canvas…</div>
      )}
      <Timeline />
    </div>
  );
}
