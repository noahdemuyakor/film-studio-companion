"use client";
/**
 * Infinite canvas: sections, text notes and generate nodes on a pannable board, with a left toolbar,
 * an assets panel, canvas settings, a minimap and a Claude assistant that lays out shots for you.
 * Generate nodes take their prompt from connected text notes and use connected images as the first
 * frame (video) or references; they render on the platform chosen under "Pay with".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Handle,
  MiniMap,
  NodeResizer,
  NodeToolbar,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChangeset,
  type Node,
  type NodeChangeset,
  type NodeProps,
} from "@xyflow/react";
import { modelById, useStudio } from "@/lib/store";
import { breakdownScript, callClaude, claudeSource } from "@/lib/engine";
import { estimateCost, produceShot } from "@/lib/router";
import { LIGHTING } from "@/lib/presets";
import type { MediaInput, ModelDef, RouteMode, Shot } from "@/lib/types";
import { artGradient, fileToDataUrl, uid } from "@/lib/util";
import {
  Brain,
  Camera,
  ChevronR,
  Close,
  Copy,
  Cursor,
  Download,
  Expand,
  Film,
  Frame,
  Hand,
  Heart,
  Image as ImageIcon,
  Layout,
  Lock,
  Mic,
  Minus,
  Note,
  Panel,
  Plus,
  Rerun,
  Search,
  Send,
  Settings as Gear,
  Spark,
  TextT,
  Trash,
  Upload,
  Wand,
} from "../Icons";
import { Select } from "../ui";
import { durationOptions, nearestRes, PayWith, Preview, resolutionOptions, RouteSelector } from "./shared";
import Timeline from "./Timeline";
import { useHydrated } from "../Hydrate";

type D = Record<string, unknown>;
type MediaKind = "image" | "video" | "voice";

function patchNode(id: string, data: D) {
  useStudio.getState().update("nodes", (ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...data } } : n)));
}
function removeNode(id: string) {
  const st = useStudio.getState();
  st.update("nodes", (ns) => ns.filter((n) => n.id !== id));
  st.update("edges", (es) => es.filter((e) => e.source !== id && e.target !== id));
}
const isVideoUrl = (u?: string) => !!u && /\.(mp4|webm|mov)(\?|$)/i.test(u);

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const SECTION_COLORS = ["#3a4650", "#4a4339", "#3b4a3d", "#4a3b48", "#363d52", "#4d3a3a"];

/** Nodes whose top-left corner lies inside the section's box. */
function membersOf(sec: Node, nodes: Node[]) {
  const w = Number(sec.measured?.width ?? sec.style?.width ?? 760);
  const h = Number(sec.measured?.height ?? sec.style?.height ?? 420);
  return nodes.filter((n) => n.id !== sec.id && n.type !== "section" && n.position.x >= sec.position.x && n.position.y >= sec.position.y && n.position.x < sec.position.x + w && n.position.y < sec.position.y + h);
}

function SectionNode({ id, data, selected }: NodeProps) {
  const collapsed = Boolean(data.collapsed);
  const color = String(data.color || SECTION_COLORS[0]);
  const toggle = () => {
    const st = useStudio.getState();
    const self = st.nodes.find((n) => n.id === id)!;
    if (!collapsed) {
      const ids = membersOf(self, st.nodes).map((n) => n.id);
      st.update("nodes", (ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, hidden: true } : n.id === id ? { ...n, data: { ...n.data, collapsed: true, hiddenIds: ids, openHeight: self.style?.height }, style: { ...n.style, height: 44 } } : n)));
    } else {
      const ids = (data.hiddenIds as string[]) || [];
      st.update("nodes", (ns) => ns.map((n) => (ids.includes(n.id) ? { ...n, hidden: false } : n.id === id ? { ...n, data: { ...n.data, collapsed: false, hiddenIds: [] }, style: { ...n.style, height: (data.openHeight as number) || 420 } } : n)));
    }
  };
  return (
    <div className="w-full h-full rounded-12 relative" style={{ background: collapsed ? "transparent" : `${color}cc`, outline: selected ? "2px solid #8db600" : "none" }}>
      {!collapsed && <NodeResizer isVisible={selected} minWidth={280} minHeight={160} color="#8db600" />}
      <div className="absolute -top-9 left-0 flex items-center gap-1.5 h-8 px-2 rounded-8 bg-[#1b2024] border border-w10 text-12 font-semibold">
        <button aria-label={collapsed ? "Expand section" : "Collapse section"} onClick={toggle} className="nodrag text-w60 hover:text-white" style={{ transform: collapsed ? "rotate(0deg)" : "rotate(90deg)" }}>
          <ChevronR size={12} />
        </button>
        <input aria-label="Section name" value={String(data.title || "Section")} onChange={(e) => patchNode(id, { title: e.target.value })} className="nodrag bg-transparent outline-none w-[140px]" />
        {selected && (
          <span className="flex items-center gap-1 nodrag">
            {SECTION_COLORS.map((c) => (
              <button key={c} aria-label="Section colour" onClick={() => patchNode(id, { color: c })} className="w-3.5 h-3.5 rounded-full border border-w20" style={{ background: c }} />
            ))}
            <button aria-label="Delete section" onClick={() => removeNode(id)} className="ml-1 text-w50 hover:text-white">
              <Trash size={11} />
            </button>
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Text notes                                                          */
/* ------------------------------------------------------------------ */

function TextNode({ id, data, selected }: NodeProps) {
  return (
    <div className={`w-[260px] rounded-12 bg-[#f4efe2] text-[#1b2024] shadow-xl ${selected ? "ring-2 ring-[#8db600]" : ""}`}>
      <div className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-semibold text-[#1b2024]/60">
        <Note size={11} /> Text note
        <span className="flex-1" />
        {selected && (
          <button aria-label="Delete note" onClick={() => removeNode(id)} className="nodrag hover:text-[#1b2024]">
            <Trash size={11} />
          </button>
        )}
      </div>
      <textarea aria-label="Note text" value={String(data.text || "")} onChange={(e) => patchNode(id, { text: e.target.value })} placeholder="Write a prompt, a beat or an idea. Connect it to a generate node to use it as the prompt." className="nodrag nowheel w-full min-h-[110px] bg-transparent px-3 pb-3 pt-1 outline-none resize-y text-13 leading-5 placeholder:text-[#1b2024]/40" />
      <Handle type="source" position={Position.Right} style={{ background: "#1b2024" }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Generate nodes (image / video / voice) and their results            */
/* ------------------------------------------------------------------ */

const ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
const KIND_LABEL: Record<MediaKind, string> = { image: "Image", video: "Video", voice: "Voice" };

/** Prompt text and images wired into a node. */
function useInputs(id: string, kind: MediaKind, mode?: string) {
  const edges = useStudio((s) => s.edges);
  const nodes = useStudio((s) => s.nodes);
  return useMemo(() => {
    const incoming = edges.filter((e) => e.target === id).map((e) => nodes.find((n) => n.id === e.source)).filter(Boolean) as Node[];
    const text = incoming.filter((n) => n.type === "text").map((n) => String(n.data.text || "").trim()).filter(Boolean).join("\n");
    const imgs = incoming
      .filter((n) => n.type === "media")
      .map((n) => {
        const shot = n.data.shot as Shot | undefined;
        const url = (n.data.upload as { url?: string } | undefined)?.url || shot?.resultUrl;
        return { node: n, url, native: shot?.platformId && shot.nativeId ? { platformId: shot.platformId, id: shot.nativeId } : undefined };
      })
      .filter((x) => x.url);
    const media: MediaInput[] = imgs.map((x, i) => ({ role: kind === "video" && mode !== "reference" && i === 0 ? "first" : "ref", url: x.url, native: x.native }));
    return { text, media, thumbs: imgs.map((x) => ({ id: x.node.id, url: x.url! })) };
  }, [edges, nodes, id, kind, mode]);
}

function KindIcon({ kind, size = 12 }: { kind: MediaKind; size?: number }) {
  return kind === "video" ? <Film size={size} /> : kind === "voice" ? <Mic size={size} /> : <ImageIcon size={size} />;
}

/** Create a node to the right of `from`, wired to it (used by the action menu and the assistant). */
function spawnFrom(from: Node, data: D, type = "media") {
  const id = uid("n");
  const w = Number(from.measured?.width ?? 280);
  const st = useStudio.getState();
  const taken = st.nodes.filter((n) => Math.abs(n.position.x - (from.position.x + w + 60)) < 40).length;
  st.update("nodes", (ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type, position: { x: from.position.x + w + 60, y: from.position.y + taken * 60 }, data, selected: true }]);
  st.update("edges", (es) => [...es, { id: uid("e"), source: from.id, target: id }]);
  return id;
}

const IMAGE_EDITS: [string, string][] = [
  ["Edit & merge", "Keep the subject from the reference and change: "],
  ["Adjust color & light", "Same image, same composition; regrade the colour and lighting to: "],
  ["Remove background", "Same subject, cleanly cut out on a plain neutral background, no shadows"],
  ["Change style", "Same subject and composition, restyled as: "],
  ["Change angle", "Same subject and setting, seen from a new camera angle: "],
  ["Character reference", "Character sheet of the same person: front, three-quarter and side views, neutral pose, plain background"],
  ["Upscale image", "Same image at higher resolution, sharper detail, no changes to content"],
];

function MediaNode({ id, data, selected }: NodeProps) {
  const st = useStudio();
  const kind = (String(data.kind || "image") as MediaKind) || "image";
  const mode = String(data.mode || "");
  const rf = useReactFlow();
  const inputs = useInputs(id, kind, mode);
  const shot = data.shot as Shot | undefined;
  const upload = data.upload as { url: string; name: string; type: string } | undefined;
  const url = upload?.url || shot?.resultUrl;
  const busy = shot?.status === "compiling" || shot?.status === "rendering";
  const models = st.models.filter((m) => m.enabled && m.kind === (kind === "voice" ? "audio" : kind));
  const model: ModelDef | undefined = models.find((m) => m.id === data.modelId) || models.find((m) => m.id === (kind === "image" ? st.imageModelId : st.modelId)) || models[0];
  const aspect = String(data.aspect || (kind === "image" ? "1:1" : "16:9"));
  const resOpts = model ? resolutionOptions(model) : [];
  const resolution = nearestRes(String(data.resolution || (kind === "image" ? "1K" : "720p")), resOpts);
  const durOpts = model && kind === "video" ? durationOptions(model) : [];
  const duration = kind === "video" ? Number(data.duration || durOpts.find((d) => d >= 5) || durOpts[0] || 5) : 0;
  const prompt = String(data.prompt || "");
  const [menu, setMenu] = useState<"" | "main" | "image" | "video">("");
  const [full, setFull] = useState(false);
  const [msg, setMsg] = useState("");
  const play = st.canvasPrefs.playOnHover;
  const cost = model ? estimateCost(model, duration || 5) : 0;
  const w = kind === "voice" ? 260 : aspect === "9:16" || aspect === "3:4" ? 200 : aspect === "1:1" ? 240 : 300;
  const nonFlick = st.routeMode === "lock" && st.platforms.find((p) => p.id === st.lockPlatform)?.adapter && !["flick", "imagineart"].includes(String(st.platforms.find((p) => p.id === st.lockPlatform)?.adapter));

  const run = async () => {
    const fullPrompt = [inputs.text, prompt].filter(Boolean).join("\n");
    if (!fullPrompt.trim()) return setMsg("Write a prompt, or connect a text note.");
    if (kind === "voice") {
      if (typeof speechSynthesis !== "undefined") speechSynthesis.speak(new SpeechSynthesisUtterance(fullPrompt));
      return setMsg("Voice preview played in your browser. Platform voice rendering isn't connected yet.");
    }
    if (!model) return setMsg("No model for this kind yet: connect a platform in Settings.");
    setMsg("");
    const settings = { ...st.settings, aspect, resolution, duration: duration || st.settings.duration };
    patchNode(id, { shot: { ...(shot || {}), status: "compiling", seed: 1, settings, title: String(data.title || "") } });
    const count = Math.max(1, Math.min(4, Number(data.count || 1)));
    const runOne = async (target: string) => {
      const r = await produceShot(
        { title: String(data.title || KIND_LABEL[kind]), prompt: fullPrompt, model, settings, cast: [], refs: [], media: inputs.media, routeMode: st.routeMode, lockId: st.lockPlatform },
        (status, partial) => patchNode(target, { shot: { ...((useStudio.getState().nodes.find((n) => n.id === target)?.data.shot as Shot) || {}), ...partial, status, seed: 1, settings } }),
      );
      patchNode(target, { shot: r });
    };
    // extra takes appear as sibling nodes, each its own render
    const self = rf.getNode(id)!;
    const extra = Array.from({ length: count - 1 }, (_, k) => {
      const nid = uid("n");
      useStudio.getState().update("nodes", (ns) => [...ns, { id: nid, type: "media", position: { x: self.position.x, y: self.position.y + (k + 1) * 320 }, data: { ...data, count: 1, title: `${data.title || KIND_LABEL[kind]} · take ${k + 2}`, shot: undefined } }]);
      useStudio.getState().update("edges", (es) => [...es, ...useStudio.getState().edges.filter((e) => e.target === id).map((e) => ({ ...e, id: uid("e"), target: nid }))]);
      return nid;
    });
    await Promise.all([runOne(id), ...extra.map(runOne)]);
  };

  const derive = (d: D) => {
    setMenu("");
    spawnFrom(rf.getNode(id)!, { kind: "image", aspect, title: `${data.title || "Image"} · edit`, ...d });
  };
  const toTimeline = () => {
    if (!url) return;
    st.update("clips", (clips) => {
      const end = clips.filter((c) => c.track === "video").reduce((m, c) => Math.max(m, c.start + c.duration), 0);
      return [...clips, { id: uid("clip"), track: "video", start: end, duration: shot?.settings.duration || 5, label: String(data.title || "Clip"), shotId: shot?.id, seed: shot?.seed || 1, transition: "cut", subtitle: "", url }];
    });
    st.set({ timelineOpen: true });
    setMenu("");
  };
  const saveStyle = () => {
    if (!url) return;
    st.update("vault", (v) => [...v, { id: uid("ref"), kind: "style", name: String(data.title || "Style"), description: shot?.compiled?.slice(0, 160) || prompt, dataUrl: url, tags: ["from canvas"], createdAt: Date.now() }]);
    setMenu("");
    setMsg("Saved to the Vault as a style.");
  };
  const duplicate = () => {
    const self = rf.getNode(id)!;
    useStudio.getState().update("nodes", (ns) => [...ns, { ...self, id: uid("n"), position: { x: self.position.x + 40, y: self.position.y + 40 }, selected: false, data: { ...self.data, title: `${data.title || KIND_LABEL[kind]} copy` } }]);
  };

  return (
    <div style={{ width: w }} className="group">
      <Handle type="target" position={Position.Left} style={{ background: "#8db600" }} />
      <div className="flex items-center gap-1 mb-1 text-12 text-w60">
        <KindIcon kind={kind} size={11} />
        <input aria-label="Node title" value={String(data.title || "")} onChange={(e) => patchNode(id, { title: e.target.value })} placeholder={KIND_LABEL[kind]} className="nodrag bg-transparent outline-none flex-1 min-w-0 truncate placeholder:text-w40" />
        {Boolean(data.fav) && <Heart size={11} className="text-[#ff5c9a]" />}
      </div>
      <div
        className={`relative rounded-10 overflow-hidden bg-[#1b2024] border ${selected ? "border-[#8db600]" : "border-w10"}`}
        style={{ aspectRatio: kind === "voice" ? "3 / 1" : aspect.replace(":", " / ") }}
        onMouseEnter={(e) => play && (e.currentTarget.querySelector("video") as HTMLVideoElement | null)?.play().catch(() => {})}
        onMouseLeave={(e) => play && (e.currentTarget.querySelector("video") as HTMLVideoElement | null)?.pause()}
      >
        {url ? (
          isVideoUrl(url) || upload?.type?.startsWith("video") ? (
            <video src={url} muted loop playsInline controls={selected} className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={String(data.title || "")} className="w-full h-full object-cover" />
          )
        ) : shot?.status === "done" && shot.simulated ? (
          <div className="absolute inset-0" style={{ background: artGradient(prompt.length * 13 + 7) }}>
            <span className="absolute left-2 top-2 text-[10px] font-semibold bg-black/60 rounded-6 px-1.5 py-0.5">Preview render</span>
          </div>
        ) : (
          <div className="absolute inset-0 grid place-items-center text-center px-3">
            <div className="flex flex-col items-center gap-1 text-w50">
              <KindIcon kind={kind} size={16} />
              <span className="text-12 font-semibold text-w70">{KIND_LABEL[kind]}{mode === "gif" ? " · GIF" : mode === "reference" ? " · reference" : ""}</span>
              <span className="text-[11px]">{busy ? (shot?.status === "compiling" ? "Claude is writing the prompt…" : "Rendering…") : "Ready to generate"}</span>
            </div>
          </div>
        )}
        {busy && <div className="absolute inset-0 shimmer" />}
        {shot?.status === "error" && <div className="absolute inset-0 bg-black/75 p-2 text-[11px] text-[#ff5c9a] overflow-auto nowheel">{shot.error}</div>}
      </div>
      {url && shot?.platformId && (
        <p className="mt-1 text-[10px] text-w40 truncate">
          {modelById(st.models, shot.modelId)?.name} · via {st.platforms.find((p) => p.id === shot.platformId)?.name} · {shot.credits} cr
        </p>
      )}
      <Handle type="source" position={Position.Right} style={{ background: "#8db600" }} />

      {/* result actions */}
      <NodeToolbar isVisible={selected && !!url} position={Position.Top} offset={8}>
        <div className="flex items-center gap-0.5 rounded-10 bg-[#1b2024] border border-w10 p-1 text-12 shadow-2xl relative">
          <ToolBtn label="Favourite" onClick={() => patchNode(id, { fav: !data.fav })}>
            <Heart size={13} className={data.fav ? "text-[#ff5c9a]" : ""} />
          </ToolBtn>
          <a aria-label="Download" href={url} download target="_blank" rel="noreferrer" className="w-7 h-7 rounded-6 grid place-items-center text-w60 hover:text-white hover:bg-w10">
            <Download size={13} />
          </a>
          <ToolBtn label="Full screen" onClick={() => setFull(true)}>
            <Expand size={13} />
          </ToolBtn>
          <ToolBtn label="Duplicate" onClick={duplicate}>
            <Copy size={13} />
          </ToolBtn>
          {kind !== "voice" && !upload && (
            <ToolBtn label="Regenerate" onClick={run}>
              <Rerun size={13} />
            </ToolBtn>
          )}
          <span className="w-px h-5 bg-w10 mx-0.5" />
          <button onClick={() => setMenu(menu ? "" : "main")} className="h-7 px-2 rounded-6 font-semibold text-w80 hover:bg-w10 flex items-center gap-1">
            <Wand size={12} /> Actions
          </button>
          <ToolBtn label="Delete" onClick={() => removeNode(id)}>
            <Trash size={13} />
          </ToolBtn>
          {menu && (
            <div className="absolute left-full top-0 ml-2 flex gap-1">
              <Menu>
                {kind === "image" || upload?.type?.startsWith("image") || (url && !isVideoUrl(url)) ? (
                  <>
                    <MenuItem onClick={() => setMenu(menu === "image" ? "main" : "image")} sub>
                      <ImageIcon size={12} /> Image
                    </MenuItem>
                    <MenuItem onClick={() => setMenu(menu === "video" ? "main" : "video")} sub>
                      <Film size={12} /> Video
                    </MenuItem>
                  </>
                ) : (
                  <MenuItem onClick={() => (setMenu(""), spawnFrom(rf.getNode(id)!, { kind: "video", mode: "reference", title: `${data.title || "Video"} · motion`, prompt: "Same motion and camera move as the reference, new subject: ", aspect }))}>
                    <Film size={12} /> Motion reference
                  </MenuItem>
                )}
                <MenuItem onClick={() => (setMenu(""), spawnFrom(rf.getNode(id)!, { kind: "voice", title: "Voice", prompt: "" }))}>
                  <Mic size={12} /> Generate voice
                </MenuItem>
                <MenuItem onClick={saveStyle}>
                  <Spark size={12} /> Save as style
                </MenuItem>
                <MenuItem onClick={toTimeline}>
                  <Film size={12} /> Add to timeline
                </MenuItem>
              </Menu>
              {menu === "image" && (
                <Menu>
                  {IMAGE_EDITS.map(([label, p]) => (
                    <MenuItem key={label} onClick={() => derive({ prompt: p, title: `${data.title || "Image"} · ${label.toLowerCase()}` })}>
                      {label}
                    </MenuItem>
                  ))}
                </Menu>
              )}
              {menu === "video" && (
                <Menu>
                  <MenuItem onClick={() => (setMenu(""), spawnFrom(rf.getNode(id)!, { kind: "video", mode: "frame", title: `${data.title || "Shot"} · video`, prompt: "", aspect: aspect === "1:1" ? "16:9" : aspect }))}>Generate video (from this frame)</MenuItem>
                  <MenuItem onClick={() => (setMenu(""), spawnFrom(rf.getNode(id)!, { kind: "video", mode: "gif", title: `${data.title || "Shot"} · GIF`, prompt: "Seamless short loop: ", duration: 3, aspect }))}>Generate GIF loop</MenuItem>
                  <MenuItem onClick={() => (setMenu(""), spawnFrom(rf.getNode(id)!, { kind: "video", mode: "reference", title: `${data.title || "Shot"} · reference video`, prompt: "", aspect: aspect === "1:1" ? "16:9" : aspect }))}>Reference video (keep this look)</MenuItem>
                </Menu>
              )}
            </div>
          )}
        </div>
      </NodeToolbar>

      {/* prompt panel */}
      <NodeToolbar isVisible={selected} position={Position.Bottom} offset={12}>
        <div className="w-[440px] rounded-12 bg-[#1b2024] border border-w10 shadow-2xl p-3 flex flex-col gap-2 text-12">
          {kind !== "voice" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip>
                <Select label="Model" value={model?.id || ""} onChange={(v) => patchNode(id, { modelId: v })} options={models.map((m) => ({ id: m.id, label: m.name }))} className="text-12 max-w-[150px]" />
              </Chip>
              <Chip>
                <Select label="Aspect ratio" value={aspect} onChange={(v) => patchNode(id, { aspect: v })} options={ASPECTS} className="text-12" />
              </Chip>
              {resOpts.length > 0 && (
                <Chip>
                  <Select label="Resolution" value={resolution} onChange={(v) => patchNode(id, { resolution: v })} options={resOpts} className="text-12" />
                </Chip>
              )}
              {kind === "video" && durOpts.length > 0 && (
                <Chip>
                  <Select label="Duration" value={String(duration)} onChange={(v) => patchNode(id, { duration: Number(v) })} options={durOpts.map((d) => ({ id: String(d), label: `${d}s` }))} className="text-12" />
                </Chip>
              )}
            </div>
          )}
          {inputs.thumbs.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-w50">{kind === "video" && mode !== "reference" ? "First frame & refs" : "References"}</span>
              {inputs.thumbs.slice(0, 6).map((t) =>
                isVideoUrl(t.url) ? (
                  <video key={t.id} src={t.url} muted className="w-9 h-9 rounded-6 object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={t.id} src={t.url} alt="" className="w-9 h-9 rounded-6 object-cover" />
                ),
              )}
              {nonFlick && <span className="text-[10px] text-w40">this platform uses the prompt only</span>}
            </div>
          )}
          {inputs.text && <p className="rounded-8 bg-w5 px-2 py-1.5 text-w60 max-h-[60px] overflow-auto nowheel">From note: {inputs.text}</p>}
          <textarea
            aria-label="Prompt"
            value={prompt}
            onChange={(e) => patchNode(id, { prompt: e.target.value })}
            placeholder={kind === "voice" ? "Line to speak…" : inputs.text ? "Add more detail (optional)…" : `Describe the ${kind} you want… or connect a text note`}
            className="nodrag nowheel w-full h-[70px] rounded-8 bg-w5 p-2 outline-none resize-none leading-5"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {kind !== "voice" && <PayWith modelId={model?.id} />}
            <span className="flex-1" />
            {kind !== "voice" && (
              <Chip>
                <Select label="Takes" value={String(data.count || 1)} onChange={(v) => patchNode(id, { count: Number(v) })} options={["1", "2", "3", "4"].map((n) => ({ id: n, label: `${n}x` }))} className="text-12" />
              </Chip>
            )}
            <button disabled={busy} onClick={run} className="h-8 px-3 rounded-8 bg-lime text-dark font-semibold flex items-center gap-1.5 disabled:opacity-60">
              <Send size={12} /> {busy ? "Working…" : kind === "voice" ? "Speak" : `Generate · ${cost * Math.max(1, Number(data.count || 1))} cr`}
            </button>
          </div>
          {msg && <p className="text-[11px] text-[#ff5c9a]">{msg}</p>}
          {shot?.route && <p className="text-[10px] text-w40">{shot.route}</p>}
        </div>
      </NodeToolbar>

      {full && url && (
        <div className="fixed inset-0 z-[100] bg-black/90 grid place-items-center p-6 nodrag" onClick={() => setFull(false)}>
          {isVideoUrl(url) ? <video src={url} controls autoPlay className="max-w-full max-h-full" /> : <img src={url} alt="" className="max-w-full max-h-full object-contain" />}
        </div>
      )}
    </div>
  );
}

const ToolBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) => (
  <button aria-label={label} title={label} onClick={onClick} className="w-7 h-7 rounded-6 grid place-items-center text-w60 hover:text-white hover:bg-w10">
    {children}
  </button>
);
const Chip = ({ children }: { children: React.ReactNode }) => <div className="h-7 rounded-6 bg-w5 px-2 flex items-center nodrag">{children}</div>;
const Menu = ({ children }: { children: React.ReactNode }) => <div className="w-[210px] rounded-10 bg-[#1b2024] border border-w10 p-1 shadow-2xl flex flex-col">{children}</div>;
const MenuItem = ({ onClick, children, sub }: { onClick: () => void; children: React.ReactNode; sub?: boolean }) => (
  <button onClick={onClick} className="h-8 px-2 rounded-6 text-left text-12 text-w80 hover:bg-w10 flex items-center gap-2">
    {children}
    {sub && <ChevronR size={11} className="ml-auto text-w40" />}
  </button>
);

/* ------------------------------------------------------------------ */
/* Earlier node types, kept so existing canvases still open             */
/* ------------------------------------------------------------------ */

function Shell({ title, icon, color, children, id, inputs = true, outputs = true }: { title: string; icon: React.ReactNode; color: string; children: React.ReactNode; id: string; inputs?: boolean; outputs?: boolean }) {
  return (
    <div className="w-[300px] rounded-16 bg-[#262d32] border border-w10 shadow-2xl text-white">
      {inputs && <Handle type="target" position={Position.Left} style={{ background: color }} />}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-w5">
        <span className="w-5 h-5 rounded-6 grid place-items-center text-dark" style={{ background: color }}>
          {icon}
        </span>
        <span className="text-12 font-semibold flex-1 truncate">{title}</span>
        <button aria-label="Delete node" onClick={() => removeNode(id)} className="text-w40 hover:text-white nodrag">
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
    r.value.scenes.slice(0, 8).forEach((sc, i) => {
      const nid = uid("n");
      newNodes.push({ id: nid, type: "media", position: { x: self.position.x + 380 + (i % 4) * 330, y: self.position.y + Math.floor(i / 4) * 320 }, data: { kind: "image", title: sc.title, prompt: `${sc.shots[0]?.description || sc.summary}. Mood: ${sc.emotion}.`, aspect: "16:9" } });
      newEdges.push({ id: uid("e"), source: id, target: nid });
    });
    useStudio.getState().update("nodes", (ns) => [...ns, ...newNodes]);
    useStudio.getState().update("edges", (es) => [...es, ...newEdges]);
    patchNode(id, { note: `${r.mode === "live" ? "Claude" : "Local engine"}: ${r.value.scenes.length} scenes → ${newNodes.length} shot nodes` });
    setBusy(false);
  };
  return (
    <Shell id={id} title="Script" icon={<Film size={11} />} color="#ffffff" inputs={false} outputs={false}>
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
          {c.locked && (
            <p className="flex items-center gap-1 text-lime">
              <Lock size={10} /> Locked across scenes
            </p>
          )}
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

/** Older "shot" nodes: shown as a generate node with their prompt and result. */
function LegacyShotNode(props: NodeProps) {
  const d = props.data as D;
  return <MediaNode {...props} data={{ ...d, kind: "video", title: d.title || "Shot" }} />;
}

function CompareNode({ id, data }: NodeProps) {
  const st = useStudio();
  const video = st.models.filter((m) => m.enabled && m.kind === "video");
  const ids = ((data.modelIds as string[]) || []).filter((m) => video.some((v) => v.id === m)).slice(0, 4);
  const results = (data.results as Record<string, Shot>) || {};
  const run = async () => {
    await Promise.all(
      ids.map(async (mid) => {
        const model = modelById(st.models, mid);
        const r = await produceShot({ title: model.name, prompt: String(data.prompt || ""), model, settings: st.settings, cast: [], refs: [], routeMode: "cheapest" as RouteMode });
        const cur = (useStudio.getState().nodes.find((n) => n.id === id)?.data.results as Record<string, Shot>) || {};
        patchNode(id, { results: { ...cur, [mid]: r } });
      }),
    );
  };
  const setSlot = (i: number, v: string) => {
    const next = [...ids];
    if (v) next[i] = v;
    else next.splice(i, 1);
    patchNode(id, { modelIds: [...new Set(next)] });
  };
  return (
    <div className="w-[560px]">
      <Shell id={id} title="Compare models side by side" icon={<Spark size={11} />} color="#b28dff" outputs={false}>
        <textarea aria-label="Comparison prompt" value={String(data.prompt || "")} onChange={(e) => patchNode(id, { prompt: e.target.value })} className="nodrag nowheel h-[48px] rounded-8 bg-w5 p-2 outline-none resize-none" />
        <div className="grid grid-cols-4 gap-1 nodrag">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-7 rounded-6 bg-w5 px-1.5 flex items-center">
              <Select label={`Model ${i + 1}`} value={ids[i] || ""} onChange={(v) => setSlot(i, v)} options={[{ id: "", label: i < ids.length ? "— remove —" : "+ add model" }, ...video.map((m) => ({ id: m.id, label: m.name }))]} className="text-[11px]" />
            </div>
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
        <div className="nodrag">
          <RouteSelector compact mode="cheapest" lock="" onChange={() => {}} />
        </div>
        <button onClick={run} disabled={!ids.length} className="nodrag h-8 rounded-8 bg-lime text-dark font-semibold disabled:opacity-50">
          Run side by side
        </button>
      </Shell>
    </div>
  );
}

const nodeTypes = { section: SectionNode, text: TextNode, media: MediaNode, script: ScriptNode, character: CharacterNode, location: LocationNode, reference: ReferenceNode, shot: LegacyShotNode, compare: CompareNode };

/* ------------------------------------------------------------------ */
/* Assistant: Claude lays out sections and nodes (it never spends)      */
/* ------------------------------------------------------------------ */

const STARTERS: [string, string][] = [
  ["Script to film", "Turn this script into a section of shots, one image node per shot, with a text note per scene:\n\n"],
  ["Scratch to film", "I have an idea for a short film. Plan 6 shots as image nodes in a new section, each with a cinematic prompt. The idea: "],
  ["Character design", "Design a character: make a section with a character sheet image node (front, side, back) and 3 expression variations. The character: "],
  ["Get inspiration", "Give me 4 striking visual concepts for a short film as image nodes in a new section, each with a one-line note. Theme: "],
];

interface AssistantAction {
  type: "section" | "image" | "video" | "note";
  title?: string;
  prompt?: string;
  text?: string;
  section?: string;
  aspect?: string;
  from?: string; // title of an image node to animate / reference
}

function applyActions(actions: AssistantAction[], at: { x: number; y: number }): string {
  const st = useStudio.getState();
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const sections: Record<string, Node> = {};
  const counts: Record<string, number> = {};
  const byTitle: Record<string, string> = {};
  let secY = at.y;
  const ensureSection = (name = "Assistant") => {
    if (sections[name]) return sections[name];
    const n: Node = { id: uid("n"), type: "section", position: { x: at.x, y: secY }, zIndex: -1, style: { width: 1380, height: 420 }, data: { title: name, color: SECTION_COLORS[Object.keys(sections).length % SECTION_COLORS.length] } };
    secY += 480;
    sections[name] = n;
    counts[n.id] = 0;
    nodes.push(n);
    return n;
  };
  actions.forEach((a) => {
    if (a.type === "section") return void ensureSection(a.title || a.section);
    const sec = ensureSection(a.section);
    const i = counts[sec.id]++;
    const cols = 4;
    const pos = { x: sec.position.x + 30 + (i % cols) * 335, y: sec.position.y + 50 + Math.floor(i / cols) * 330 };
    const rows = Math.floor(i / cols) + 1;
    sec.style = { ...sec.style, height: Math.max(Number(sec.style?.height || 420), 60 + rows * 330) };
    const id = uid("n");
    if (a.type === "note") nodes.push({ id, type: "text", position: pos, data: { text: a.text || a.prompt || "" } });
    else nodes.push({ id, type: "media", position: pos, data: { kind: a.type, title: a.title || (a.type === "video" ? "Video" : "Image"), prompt: a.prompt || "", aspect: a.aspect || (a.type === "video" ? "16:9" : "16:9"), mode: a.type === "video" && a.from ? "frame" : undefined } });
    if (a.title) byTitle[a.title.toLowerCase()] = id;
    if (a.from) {
      const src = byTitle[a.from.toLowerCase()] || st.nodes.find((n) => String(n.data.title || "").toLowerCase() === a.from!.toLowerCase())?.id;
      if (src) edges.push({ id: uid("e"), source: src, target: id });
    }
  });
  st.update("nodes", (ns) => [...ns, ...nodes]);
  st.update("edges", (es) => [...es, ...edges]);
  const made = nodes.filter((n) => n.type !== "section").length;
  return `${made} node${made === 1 ? "" : "s"} in ${Object.keys(sections).length} section${Object.keys(sections).length === 1 ? "" : "s"}`;
}

function Assistant({ onClose }: { onClose: () => void }) {
  const st = useStudio();
  const rf = useReactFlow();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const selected = st.nodes.filter((n) => n.selected && n.type !== "section");
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [st.canvasChat.length, busy]);
  const send = async (msg = text) => {
    if (!msg.trim() || busy) return;
    setText("");
    const chat = [...st.canvasChat, { role: "user" as const, text: msg }];
    st.set({ canvasChat: chat });
    if (claudeSource() === "none") return st.set({ canvasChat: [...chat, { role: "assistant", text: "Connect Claude first: start the local bridge and save its token in Settings → Local bridge (or add an API key)." }] });
    setBusy(true);
    const canvas = st.nodes
      .filter((n) => ["section", "text", "media"].includes(String(n.type)))
      .slice(-40)
      .map((n) => `${n.type}${n.selected ? " (selected)" : ""}: ${String(n.data.title || n.data.text || "").slice(0, 80)}${n.data.prompt ? ` — ${String(n.data.prompt).slice(0, 120)}` : ""}`)
      .join("\n");
    const system = `You are the creative assistant on an AI film studio's canvas. Talk like a helpful director: short and concrete.
When the user wants things made, add them to the canvas with actions; nodes are only laid out, never rendered (the user presses Generate, which spends their credits).
Reply with JSON only: {"reply": string, "actions": [{"type": "section"|"image"|"video"|"note", "title": string, "prompt": string (a vivid, model-ready visual prompt for image/video), "text": string (for notes), "section": string (section name to place it in), "aspect": "16:9"|"9:16"|"1:1", "from": string (title of an image node this video animates)}]}.
Use one section per scene or idea. Keep prompts self-contained (subject, action, setting, shot, light, style). Use "actions": [] when just talking.`;
    const user = `Canvas now:\n${canvas || "(empty)"}\n\nConversation:\n${chat
      .slice(-8)
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n")}`;
    try {
      const raw = (await callClaude(system, user, 3000)) || "";
      const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { reply?: string; actions?: AssistantAction[] };
      let note = "";
      if (j.actions?.length) {
        const vp = rf.getViewport();
        const bottom = Math.max(0, ...useStudio.getState().nodes.map((n) => n.position.y + Number(n.measured?.height ?? n.style?.height ?? 300)));
        note = `\n\nAdded ${applyActions(j.actions, { x: -vp.x / vp.zoom + 40, y: bottom + 120 })}. Select a node and press Generate when you're ready.`;
        setTimeout(() => rf.fitView({ padding: 0.15, duration: 600 }), 50);
      }
      useStudio.getState().set({ canvasChat: [...chat, { role: "assistant", text: (j.reply || "Done.") + note }] });
    } catch (e) {
      useStudio.getState().set({ canvasChat: [...chat, { role: "assistant", text: `I couldn't finish that: ${e instanceof Error ? e.message : String(e)}` }] });
    }
    setBusy(false);
  };
  return (
    <aside className="w-[340px] shrink-0 border-l border-w5 bg-[#1f2529] flex flex-col min-h-0">
      <div className="h-10 px-3 flex items-center gap-2 border-b border-w5 text-12">
        <Brain size={13} className="text-lime" />
        <span className="font-semibold flex-1">Claude assistant</span>
        <button onClick={() => st.set({ canvasChat: [] })} className="text-w50 hover:text-white">
          New chat
        </button>
        <button aria-label="Close assistant" onClick={onClose} className="text-w50 hover:text-white">
          <Close size={13} />
        </button>
      </div>
      <div className="flex-1 overflow-auto thin-scroll p-3 flex flex-col gap-2 text-13">
        {st.canvasChat.length === 0 && (
          <div className="mt-auto flex flex-col gap-2">
            <p className="text-16 font-semibold">What are we making?</p>
            <p className="text-12 text-w50">I lay out sections, notes and shots on the canvas. Nothing renders until you press Generate.</p>
            {STARTERS.map(([label, p]) => (
              <button key={label} onClick={() => setText(p)} className="h-10 rounded-10 bg-w5 hover:bg-w10 px-3 text-left font-semibold flex items-center gap-2">
                <Wand size={13} className="text-lime" /> {label}
              </button>
            ))}
          </div>
        )}
        {st.canvasChat.map((m, i) => (
          <div key={i} className={`rounded-10 px-3 py-2 whitespace-pre-wrap leading-5 ${m.role === "user" ? "bg-w10 self-end max-w-[85%]" : "bg-w5 text-w80"}`}>
            {m.text}
          </div>
        ))}
        {busy && <div className="rounded-10 px-3 py-2 bg-w5 text-w50">Claude is thinking…</div>}
        <div ref={end} />
      </div>
      <div className="p-3 border-t border-w5 flex flex-col gap-2">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 text-[11px]">
            {selected.slice(0, 4).map((n) => (
              <span key={n.id} className="rounded-6 bg-w10 px-1.5 py-0.5">
                {String(n.data.title || n.type)}
              </span>
            ))}
            <span className="text-w40">selected: Claude sees these</span>
          </div>
        )}
        <div className="rounded-12 bg-w5 flex items-end gap-2 p-2">
          <textarea
            aria-label="Message Claude"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Brainstorm or build anything on the canvas…"
            className="flex-1 bg-transparent outline-none resize-none h-[60px] text-13 leading-5"
          />
          <button aria-label="Send" disabled={busy || !text.trim()} onClick={() => send()} className="w-8 h-8 rounded-full bg-lime text-dark grid place-items-center disabled:opacity-40">
            <Send size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Board: toolbar, panels, shortcuts                                   */
/* ------------------------------------------------------------------ */

function Board() {
  const st = useStudio();
  const { nodes, edges, update, canvasPrefs } = st;
  const rf = useReactFlow();
  const { zoom } = useViewport();
  const [hand, setHand] = useState(false);
  const [panel, setPanel] = useState<"" | "add" | "video" | "assets" | "settings" | "zoom">("");
  const [q, setQ] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const prefs = (p: Partial<typeof canvasPrefs>) => st.set({ canvasPrefs: { ...canvasPrefs, ...p } });

  const onNodesChange = useCallback((c: NodeChangeset<Node>) => update("nodes", (ns) => c.applyTo(ns)), [update]);
  const onEdgesChange = useCallback((c: EdgeChangeset<Edge>) => update("edges", (es) => c.applyTo(es)), [update]);
  const onConnect = useCallback((c: Connection) => update("edges", (es) => addEdge({ ...c }, es)), [update]);

  const center = () => rf.screenToFlowPosition({ x: window.innerWidth / 2 - (canvasPrefs.assistantOpen ? 170 : 0), y: window.innerHeight / 2.6 });
  const add = (type: string, data: D, style?: Node["style"]) => {
    const c = center();
    const id = uid("n");
    update("nodes", (ns) => [...ns.map((n) => ({ ...n, selected: false })), { id, type, position: { x: c.x - 120 + Math.random() * 40, y: c.y - 80 + Math.random() * 40 }, data, selected: true, ...(type === "section" ? { zIndex: -1, style: style || { width: 760, height: 420 } } : {}) }]);
    setPanel("");
    return id;
  };
  const addSection = () => add("section", { title: `Section ${nodes.filter((n) => n.type === "section").length + 1}`, color: SECTION_COLORS[nodes.filter((n) => n.type === "section").length % SECTION_COLORS.length] });
  const addText = () => add("text", { text: "" });
  const onUpload = async (f?: File) => {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024 && f.type.startsWith("image")) return alert("Images up to 4 MB can be kept on the canvas.");
    const url = f.type.startsWith("video") ? URL.createObjectURL(f) : await fileToDataUrl(f);
    add("media", { kind: f.type.startsWith("video") ? "video" : "image", title: f.name.replace(/\.[^.]+$/, ""), upload: { url, name: f.name, type: f.type }, aspect: "16:9" });
  };

  /** lay every section's members out in a neat grid, and loose nodes in a row below */
  const tidy = () => {
    const all = useStudio.getState().nodes;
    const pos: Record<string, { x: number; y: number }> = {};
    const secs = all.filter((n) => n.type === "section" && !n.data.collapsed);
    secs.forEach((s) => {
      const m = membersOf(s, all).sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x);
      const cols = Math.max(1, Math.floor((Number(s.measured?.width ?? s.style?.width ?? 760) - 40) / 330));
      m.forEach((n, i) => (pos[n.id] = { x: s.position.x + 30 + (i % cols) * 330, y: s.position.y + 50 + Math.floor(i / cols) * 330 }));
    });
    update("nodes", (ns) => ns.map((n) => (pos[n.id] ? { ...n, position: pos[n.id] } : n)));
    setTimeout(() => rf.fitView({ padding: 0.15, duration: 500 }), 30);
  };

  // keyboard: S section, T text, V select, H hand, Ctrl/Cmd+D duplicate
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input,textarea,select,[contenteditable=true]")) return;
      if (e.key === "s" || e.key === "S") addSection();
      else if (e.key === "t" || e.key === "T") addText();
      else if (e.key === "h" || e.key === "H") setHand(true);
      else if (e.key === "v" || e.key === "V") setHand(false);
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const sel = useStudio.getState().nodes.filter((n) => n.selected && n.type !== "section");
        update("nodes", (ns) => [...ns.map((n) => ({ ...n, selected: false })), ...sel.map((n) => ({ ...n, id: uid("n"), position: { x: n.position.x + 40, y: n.position.y + 40 }, selected: true }))]);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  const shownEdges = useMemo(() => {
    if (canvasPrefs.lines === "off") return edges.map((e) => ({ ...e, hidden: true }));
    if (canvasPrefs.lines === "selected") {
      const sel = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
      return edges.map((e) => ({ ...e, hidden: !(sel.has(e.source) || sel.has(e.target)) }));
    }
    return edges;
  }, [edges, nodes, canvasPrefs.lines]);

  const assets = useMemo(() => {
    const media = nodes.filter((n) => n.type === "media" || n.type === "shot");
    const secs = nodes.filter((n) => n.type === "section");
    const groups = secs.map((s) => ({ s, items: membersOf(s, media) }));
    const placed = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
    const loose = media.filter((m) => !placed.has(m.id));
    const match = (n: Node) => !q || `${n.data.title || ""} ${n.data.prompt || ""}`.toLowerCase().includes(q.toLowerCase());
    return { groups: groups.map((g) => ({ ...g, items: g.items.filter(match) })), loose: loose.filter(match) };
  }, [nodes, q]);
  const focus = (n: Node) => {
    update("nodes", (ns) => ns.map((x) => ({ ...x, selected: x.id === n.id })));
    rf.setCenter(n.position.x + 140, n.position.y + 140, { zoom: Math.max(zoom, 0.9), duration: 500 });
  };
  const thumb = (n: Node) => (n.data.upload as { url?: string } | undefined)?.url || (n.data.shot as Shot | undefined)?.resultUrl;

  return (
    <div className="flex flex-1 min-h-0">
      <div className="relative flex-1 min-w-0">
        <ReactFlow
          nodes={nodes}
          edges={shownEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2.5}
          panOnDrag={hand ? true : [1, 2]}
          selectionOnDrag={!hand}
          panOnScroll
          zoomOnPinch
          deleteKeyCode={["Backspace", "Delete"]}
          className="dark"
          defaultEdgeOptions={{ style: { stroke: "#8db60099", strokeWidth: 1.5 } }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="#ffffff1c" />
          {canvasPrefs.minimap && <MiniMap pannable zoomable className="!bg-[#1f2529]" maskColor="#00000088" nodeColor={(n) => (n.type === "section" ? String(n.data.color || "#3a4650") : n.type === "text" ? "#f4efe2" : "#8db600")} />}
        </ReactFlow>

        {/* left toolbar */}
        <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-0.5 rounded-12 bg-[#1f2529] border border-w10 p-1 shadow-2xl">
          <TBtn label="Add node" active={panel === "add" || panel === "video"} onClick={() => setPanel(panel === "add" ? "" : "add")} primary>
            <Plus size={15} />
          </TBtn>
          <TBtn label="Select (V)" active={!hand} onClick={() => setHand(false)}>
            <Cursor size={14} />
          </TBtn>
          <TBtn label="Hand: pan (H)" active={hand} onClick={() => setHand(true)}>
            <Hand size={14} />
          </TBtn>
          <TBtn label="Add section (S)" onClick={addSection}>
            <Frame size={14} />
          </TBtn>
          <TBtn label="Add text note (T)" onClick={addText}>
            <TextT size={14} />
          </TBtn>
          <TBtn label="Tidy canvas" onClick={tidy}>
            <Layout size={14} />
          </TBtn>
          <span className="w-6 h-px bg-w10 my-0.5" />
          <TBtn label="Assets" active={panel === "assets"} onClick={() => setPanel(panel === "assets" ? "" : "assets")}>
            <ImageIcon size={14} />
          </TBtn>
          <TBtn label="Canvas settings" active={panel === "settings"} onClick={() => setPanel(panel === "settings" ? "" : "settings")}>
            <Gear size={14} />
          </TBtn>
          <button aria-label="Zoom options" onClick={() => setPanel(panel === "zoom" ? "" : "zoom")} className="h-7 w-9 rounded-6 text-[11px] font-semibold text-w60 hover:bg-w10 hover:text-white">
            {Math.round(zoom * 100)}%
          </button>
          <TBtn label={canvasPrefs.assistantOpen ? "Hide assistant" : "Show assistant"} active={canvasPrefs.assistantOpen} onClick={() => prefs({ assistantOpen: !canvasPrefs.assistantOpen })}>
            <Panel size={14} />
          </TBtn>
        </div>

        {/* add menu */}
        {(panel === "add" || panel === "video") && (
          <div className="absolute left-16 top-1/2 -translate-y-[60%] z-20 flex gap-1">
            <Menu>
              <MenuItem onClick={() => file.current?.click()}>
                <Upload size={12} /> Upload image or video
              </MenuItem>
              <MenuItem onClick={addText}>
                <Note size={12} /> Text note
              </MenuItem>
              <MenuItem onClick={() => add("media", { kind: "image", title: "Image", aspect: "1:1" })}>
                <ImageIcon size={12} /> Generate image
              </MenuItem>
              <MenuItem onClick={() => setPanel(panel === "video" ? "add" : "video")} sub>
                <Film size={12} /> Generate video
              </MenuItem>
              <MenuItem onClick={() => add("media", { kind: "voice", title: "Voice" })}>
                <Mic size={12} /> Generate voice
              </MenuItem>
              <span className="h-px bg-w10 my-1" />
              <MenuItem onClick={() => add("script", { text: "" })}>
                <Brain size={12} /> Script breakdown
              </MenuItem>
              <MenuItem onClick={() => add("character", { castId: useStudio.getState().cast[0]?.id })}>
                <Camera size={12} /> Character
              </MenuItem>
              <MenuItem onClick={() => add("compare", { prompt: "", modelIds: [] })}>
                <Spark size={12} /> Compare models
              </MenuItem>
            </Menu>
            {panel === "video" && (
              <Menu>
                <MenuItem onClick={() => add("media", { kind: "video", mode: "frame", title: "Video", aspect: "16:9" })}>Frame to video</MenuItem>
                <MenuItem onClick={() => add("media", { kind: "video", mode: "reference", title: "Reference video", aspect: "16:9" })}>Reference video</MenuItem>
                <MenuItem onClick={() => add("media", { kind: "video", mode: "gif", title: "GIF loop", duration: 3, prompt: "Seamless short loop: ", aspect: "1:1" })}>GIF loop</MenuItem>
              </Menu>
            )}
          </div>
        )}
        <input ref={file} type="file" accept="image/*,video/*" hidden onChange={(e) => (onUpload(e.target.files?.[0]), (e.target.value = ""))} />

        {/* assets */}
        {panel === "assets" && (
          <div className="absolute left-16 top-4 bottom-4 z-20 w-[280px] rounded-12 bg-[#1f2529] border border-w10 shadow-2xl flex flex-col">
            <div className="h-10 px-3 flex items-center gap-2 border-b border-w5 text-12 font-semibold">
              Assets
              <span className="flex-1" />
              <button aria-label="Close assets" onClick={() => setPanel("")} className="text-w50 hover:text-white">
                <Close size={12} />
              </button>
            </div>
            <div className="p-2">
              <div className="h-8 rounded-8 bg-w5 px-2 flex items-center gap-1.5">
                <Search size={12} className="text-w40" />
                <input aria-label="Search assets" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles and prompts" className="flex-1 bg-transparent outline-none text-12" />
              </div>
            </div>
            <div className="flex-1 overflow-auto thin-scroll px-2 pb-2 text-12">
              {[...assets.groups.map((g) => ({ name: String(g.s.data.title || "Section"), items: g.items })), { name: "Not in a section", items: assets.loose }]
                .filter((g) => g.items.length)
                .map((g) => (
                  <div key={g.name} className="mb-2">
                    <p className="px-1 py-1 text-w50 font-semibold flex items-center gap-1">
                      <Frame size={11} /> {g.name} <span className="ml-auto text-w40">{g.items.length}</span>
                    </p>
                    {g.items.map((n) => (
                      <button key={n.id} onClick={() => focus(n)} className="w-full flex items-center gap-2 rounded-8 px-1 py-1 hover:bg-w5 text-left">
                        {thumb(n) ? (
                          isVideoUrl(thumb(n)) ? <video src={thumb(n)} muted className="w-9 h-9 rounded-6 object-cover" /> : <img src={thumb(n)} alt="" className="w-9 h-9 rounded-6 object-cover" />
                        ) : (
                          <span className="w-9 h-9 rounded-6 bg-w5 grid place-items-center text-w40">
                            <KindIcon kind={(String(n.data.kind || "image") as MediaKind) || "image"} />
                          </span>
                        )}
                        <span className="flex-1 min-w-0 truncate">{String(n.data.title || "Untitled")}</span>
                        {Boolean(n.data.fav) && <Heart size={10} className="text-[#ff5c9a]" />}
                      </button>
                    ))}
                  </div>
                ))}
              {!assets.groups.some((g) => g.items.length) && !assets.loose.length && <p className="text-w40 p-2">Nothing yet. Generated and uploaded media appear here.</p>}
            </div>
          </div>
        )}

        {/* settings */}
        {panel === "settings" && (
          <div className="absolute left-16 top-1/2 -translate-y-1/2 z-20 w-[260px] rounded-12 bg-[#1f2529] border border-w10 shadow-2xl p-3 flex flex-col gap-3 text-12">
            <div>
              <p className="font-semibold mb-1.5">Lines between nodes</p>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-8 bg-w5">
                {(["all", "selected", "off"] as const).map((l) => (
                  <button key={l} onClick={() => prefs({ lines: l })} className={`h-7 rounded-6 capitalize font-semibold ${canvasPrefs.lines === l ? "bg-w10 text-white" : "text-w50"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Minimap" on={canvasPrefs.minimap} set={(v) => prefs({ minimap: v })} />
            <Toggle label="Play media on hover" on={canvasPrefs.playOnHover} set={(v) => prefs({ playOnHover: v })} />
            <p className="text-w40 text-[11px] leading-4">Scroll to pan · pinch or Ctrl+scroll to zoom · drag on empty space to select (hold the middle button, or use Hand, to pan) · S section · T text · Delete removes · Ctrl+D duplicates</p>
          </div>
        )}

        {/* zoom */}
        {panel === "zoom" && (
          <div className="absolute left-16 bottom-16 z-20">
            <Menu>
              <MenuItem onClick={() => (rf.fitView({ padding: 0.15, duration: 400 }), setPanel(""))}>Zoom to fit</MenuItem>
              {[0.5, 1, 2].map((z) => (
                <MenuItem key={z} onClick={() => (rf.zoomTo(z, { duration: 300 }), setPanel(""))}>
                  {z * 100}%
                </MenuItem>
              ))}
              <div className="flex gap-1 p-1">
                <button aria-label="Zoom out" onClick={() => rf.zoomOut({ duration: 200 })} className="flex-1 h-7 rounded-6 bg-w5 grid place-items-center">
                  <Minus size={12} />
                </button>
                <button aria-label="Zoom in" onClick={() => rf.zoomIn({ duration: 200 })} className="flex-1 h-7 rounded-6 bg-w5 grid place-items-center">
                  <Plus size={12} />
                </button>
              </div>
            </Menu>
          </div>
        )}

        {nodes.length === 0 && (
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center text-w50 text-13">
              <p className="text-16 font-semibold text-w70">An empty canvas</p>
              <p>Press + to add a node, S for a section, T for a note, or ask Claude on the right.</p>
            </div>
          </div>
        )}
      </div>
      {canvasPrefs.assistantOpen && <Assistant onClose={() => prefs({ assistantOpen: false })} />}
    </div>
  );
}

const TBtn = ({ label, onClick, children, active, primary }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; primary?: boolean }) => (
  <button aria-label={label} title={label} onClick={onClick} className={`w-9 h-9 rounded-8 grid place-items-center ${primary ? "bg-lime text-dark" : active ? "bg-w10 text-white" : "text-w60 hover:bg-w10 hover:text-white"}`}>
    {children}
  </button>
);

const Toggle = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
  <label className="flex items-center justify-between cursor-pointer">
    <span className="font-semibold">{label}</span>
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => set(!on)} className={`w-9 h-5 rounded-full relative ${on ? "bg-lime" : "bg-w10"}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </button>
  </label>
);

export default function Canvas() {
  const hydrated = useHydrated();
  return (
    <div className="flex flex-col h-[calc(100vh-52px)] md:h-[calc(100vh-36px)]">
      <h1 className="sr-only">Infinite canvas</h1>
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
