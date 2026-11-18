"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import type { Clip, TrackId } from "@/lib/types";
import { artGradient, clamp, downloadBlob, downloadText, fmtTime, uid } from "@/lib/util";
import { ChevronD, Download, Film, Mic, Music, Pause, Play, Plus, Trash, Wave } from "../Icons";
import { Select } from "../ui";
import { ResizeHandle, usePanelSize } from "../Resize";

const TRACKS: { id: TrackId; label: string; icon: typeof Film; color: string }[] = [
  { id: "video", label: "Video", icon: Film, color: "#8db600" },
  { id: "dialogue", label: "Dialogue / TTS", icon: Mic, color: "#7cc4ff" },
  { id: "sfx", label: "SFX", icon: Wave, color: "#ffb347" },
  { id: "music", label: "Music", icon: Music, color: "#ff5c9a" },
];

function seedColors(seed: number) {
  const r = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const h1 = Math.floor(r(1) * 360);
  const h2 = (h1 + 30 + Math.floor(r(2) * 120)) % 360;
  return [`hsl(${h1} 60% 45%)`, `hsl(${h2} 45% 18%)`];
}

function srtTime(s: number) {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
}

export default function Timeline({ docked = true }: { docked?: boolean }) {
  const clips = useStudio((s) => s.clips);
  const set = useStudio((s) => s.set);
  const update = useStudio((s) => s.update);
  const burn = useStudio((s) => s.burnSubtitles);
  const open = useStudio((s) => s.timelineOpen);
  const [pps, setPps] = useState(48);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [height, setHeight] = usePanelSize("timeline-height", 300, 180, 640);
  const [monW, setMonW] = usePanelSize("timeline-monitor", 220, 160, 480);
  const [rendering, setRendering] = useState(0);
  const lane = useRef<HTMLDivElement>(null);
  const total = useMemo(() => Math.max(10, ...clips.map((c) => c.start + c.duration)), [clips]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      setTime((t) => {
        const n = t + (now - last) / 1000;
        if (n >= total) {
          setPlaying(false);
          return 0;
        }
        return n;
      });
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  const at = (track: TrackId, t: number) => clips.find((c) => c.track === track && t >= c.start && t < c.start + c.duration);
  const vClip = at("video", time);
  const sub = at("dialogue", time)?.subtitle || at("dialogue", time)?.label.replace(/^[A-Z ]+:\s*/, "") || vClip?.subtitle;
  const selClip = clips.find((c) => c.id === sel);
  const patch = (id: string, p: Partial<Clip>) => update("clips", (v) => v.map((c) => (c.id === id ? { ...c, ...p } : c)));

  const drag = (e: React.PointerEvent, c: Clip, mode: "move" | "l" | "r") => {
    e.stopPropagation();
    setSel(c.id);
    const x0 = e.clientX;
    const s0 = c.start;
    const d0 = c.duration;
    const onMove = (ev: PointerEvent) => {
      const dt = Math.round(((ev.clientX - x0) / pps) * 10) / 10;
      if (mode === "move") patch(c.id, { start: Math.max(0, s0 + dt) });
      if (mode === "r") patch(c.id, { duration: clamp(d0 + dt, 0.5, 30) });
      if (mode === "l") {
        const ns = clamp(s0 + dt, 0, s0 + d0 - 0.5);
        patch(c.id, { start: ns, duration: d0 - (ns - s0) });
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const split = () => {
    if (!selClip || time <= selClip.start || time >= selClip.start + selClip.duration) return;
    const a = time - selClip.start;
    update("clips", (v) => [...v.filter((c) => c.id !== selClip.id), { ...selClip, duration: a }, { ...selClip, id: uid("clip"), start: time, duration: selClip.duration - a }]);
  };

  const exportEdl = () =>
    downloadText(
      "final-cut.edl.json",
      JSON.stringify({ app: "Film Studio Companion", fps: 24, duration: total, burnSubtitles: burn, tracks: TRACKS.map((t) => ({ track: t.id, clips: clips.filter((c) => c.track === t.id).sort((a, b) => a.start - b.start) })) }, null, 2),
    );
  const exportSrt = () => {
    const subs = clips.filter((c) => (c.track === "dialogue" || c.track === "video") && (c.subtitle || c.track === "dialogue")).sort((a, b) => a.start - b.start);
    const text = subs.map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.start + c.duration)}\n${c.subtitle || c.label.replace(/^[A-Z ]+:\s*/, "")}\n`).join("\n");
    downloadText("final-cut.srt", text, "text/plain");
  };
  const renderWebm = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    const done = new Promise<void>((r) => (rec.onstop = () => r()));
    rec.start();
    const fps = 30;
    for (let f = 0; f < total * fps; f++) {
      const t = f / fps;
      const v = at("video", t);
      if (v) {
        const [a, b] = seedColors(v.seed);
        const g = ctx.createLinearGradient(0, 0, 1280, 720);
        g.addColorStop(0, a);
        g.addColorStop(1, b);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 1280, 720);
        // transitions
        const into = t - v.start;
        if (v.transition !== "cut" && into < 0.6) {
          ctx.fillStyle = `rgba(0,0,0,${1 - into / 0.6})`;
          ctx.fillRect(0, 0, 1280, 720);
        }
        ctx.fillStyle = "rgba(255,255,255,.85)";
        ctx.font = "600 28px sans-serif";
        ctx.fillText(v.label, 48, 64);
      } else {
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, 1280, 720);
      }
      const d = at("dialogue", t);
      const s = d?.subtitle || d?.label.replace(/^[A-Z ]+:\s*/, "") || v?.subtitle;
      if (burn && s) {
        ctx.font = "600 34px sans-serif";
        const w = ctx.measureText(s).width;
        ctx.fillStyle = "rgba(0,0,0,.6)";
        ctx.fillRect(640 - w / 2 - 16, 620, w + 32, 52);
        ctx.fillStyle = "#fff";
        ctx.fillText(s, 640 - w / 2, 658);
      }
      setRendering(Math.round((f / (total * fps)) * 100));
      await new Promise((r) => setTimeout(r, 1000 / fps));
    }
    rec.stop();
    await done;
    setRendering(0);
    downloadBlob("final-cut-animatic.webm", new Blob(chunks, { type: "video/webm" }));
  };

  if (docked && !open)
    return (
      <button onClick={() => set({ timelineOpen: true })} className="w-full h-10 border-t border-w10 bg-[#232a2f] flex items-center gap-2 px-4 text-12 font-semibold">
        <Film size={14} /> Timeline · {clips.length} clips · {fmtTime(total)} <ChevronD size={14} className="rotate-180 ml-auto" />
      </button>
    );

  return (
    <div id="timeline" className="border-t border-w10 bg-[#232a2f] flex flex-col" style={{ height: docked ? height : undefined }}>
      {docked && (
        <ResizeHandle label="Resize timeline" axis="y" dir={-1} size={height} setSize={setHeight} def={300} min={180} max={640} className="w-full" />
      )}
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-w5 text-12">
        <span className="font-semibold flex items-center gap-1.5">
          <Film size={14} /> Timeline
        </span>
        <button aria-label={playing ? "Pause" : "Play"} onClick={() => setPlaying(!playing)} className="w-7 h-7 rounded-full bg-lime text-dark grid place-items-center">
          {playing ? <Pause size={12} /> : <Play size={12} />}
        </button>
        <span className="tabular-nums text-w60">
          {fmtTime(time)} / {fmtTime(total)}
        </span>
        <label className="flex items-center gap-1 text-w60 ml-2">
          <input type="checkbox" checked={burn} onChange={(e) => set({ burnSubtitles: e.target.checked })} className="accent-[#8db600]" /> Burn subtitles
        </label>
        <label className="flex items-center gap-1 text-w60">
          Zoom <input aria-label="Zoom" type="range" min={16} max={120} value={pps} onChange={(e) => setPps(Number(e.target.value))} className="w-20 accent-[#8db600]" />
        </label>
        <div className="ml-auto flex items-center gap-1.5">
          {(["sfx", "music"] as TrackId[]).map((t) => (
            <button key={t} onClick={() => update("clips", (v) => [...v, { id: uid("clip"), track: t, start: time, duration: 4, label: t === "sfx" ? "New SFX" : "New cue", seed: Date.now() % 997, transition: "fade" }])} className="h-7 px-2 rounded-6 bg-w5 flex items-center gap-1">
              <Plus size={10} /> {t === "sfx" ? "SFX" : "Music"}
            </button>
          ))}
          <button onClick={exportEdl} className="h-7 px-2 rounded-6 bg-w5 flex items-center gap-1">
            <Download size={12} /> Edit list
          </button>
          <button onClick={exportSrt} className="h-7 px-2 rounded-6 bg-w5">
            .srt
          </button>
          <button disabled={!!rendering} onClick={renderWebm} className="h-7 px-2 rounded-6 bg-white text-dark font-semibold">
            {rendering ? `Rendering ${rendering}%` : "Export final cut"}
          </button>
          {docked && (
            <button aria-label="Collapse timeline" onClick={() => set({ timelineOpen: false })} className="w-7 h-7 rounded-6 bg-w5 grid place-items-center">
              <ChevronD size={14} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 flex">
        <div className="relative hidden md:flex shrink-0 p-2 flex-col gap-2 border-r border-w5" style={{ width: monW }}>
          <ResizeHandle label="Resize timeline monitor" size={monW} setSize={setMonW} def={220} min={160} max={480} className="absolute top-0 bottom-0 -right-1" />
          <div className="relative aspect-video rounded-8 overflow-hidden" style={{ background: vClip ? artGradient(vClip.seed) : "#000" }}>
            {vClip && <span className="absolute left-1.5 top-1 text-[10px] font-semibold">{vClip.label}</span>}
            {burn && sub && <span className="absolute inset-x-2 bottom-1.5 text-center text-[10px] font-semibold bg-black/60 rounded-[3px] px-1 leading-4">{sub}</span>}
          </div>
          {selClip ? (
            <div className="flex flex-col gap-1.5 text-12">
              <input aria-label="Clip label" value={selClip.label} onChange={(e) => patch(selClip.id, { label: e.target.value })} className="h-7 rounded-6 bg-w5 px-2 outline-none" />
              <input aria-label="Subtitle" value={selClip.subtitle || ""} placeholder="Subtitle text" onChange={(e) => patch(selClip.id, { subtitle: e.target.value })} className="h-7 rounded-6 bg-w5 px-2 outline-none" />
              <div className="flex gap-1.5">
                <div className="flex-1 h-7 rounded-6 bg-w5 px-2 flex items-center">
                  <Select label="Transition" value={selClip.transition} onChange={(v) => patch(selClip.id, { transition: v as Clip["transition"] })} options={["cut", "fade", "dissolve"]} className="text-12" />
                </div>
                <button onClick={split} className="h-7 px-2 rounded-6 bg-w5">
                  Split
                </button>
                <button aria-label="Delete clip" onClick={() => (update("clips", (v) => v.filter((c) => c.id !== selClip.id)), setSel(null))} className="h-7 w-7 rounded-6 bg-w5 grid place-items-center">
                  <Trash size={12} />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-w40">Drag clips to move, drag their edges to trim. Select a clip to edit its subtitle and transition.</p>
          )}
        </div>
        <div className="thin-scroll flex-1 overflow-auto relative" ref={lane} onClick={() => setSel(null)}>
          <div className="relative" style={{ width: Math.max(800, (total + 6) * pps + 120) }}>
            <div
              className="h-6 ml-[120px] relative border-b border-w5 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                setTime(clamp((e.clientX - r.left) / pps, 0, total));
              }}
            >
              {Array.from({ length: Math.ceil(total + 6) }, (_, s) => (
                <span key={s} className="absolute top-0 h-full border-l border-w10 text-[10px] text-w40 pl-1" style={{ left: s * pps }}>
                  {s % (pps < 30 ? 5 : 1) === 0 ? `${s}s` : ""}
                </span>
              ))}
            </div>
            {TRACKS.map((t) => (
              <div key={t.id} className="flex h-12 border-b border-w5">
                <div className="sticky left-0 z-10 w-[120px] shrink-0 bg-[#232a2f] border-r border-w5 flex items-center gap-1.5 px-2 text-12 text-w60">
                  <t.icon size={12} /> {t.label}
                </div>
                <div className="relative flex-1">
                  {clips
                    .filter((c) => c.track === t.id)
                    .map((c) => (
                      <div
                        key={c.id}
                        onPointerDown={(e) => drag(e, c, "move")}
                        onClick={(e) => e.stopPropagation()}
                        className={`absolute top-1.5 bottom-1.5 rounded-6 overflow-hidden cursor-grab select-none text-[11px] font-semibold flex items-center px-2 ${sel === c.id ? "ring-2 ring-white" : ""}`}
                        style={{ left: c.start * pps, width: c.duration * pps, background: t.id === "video" ? artGradient(c.seed) : `${t.color}33`, borderLeft: `3px solid ${t.color}` }}
                        title={c.label}
                      >
                        <span className="truncate drop-shadow">{c.label}</span>
                        {c.transition !== "cut" && <span className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/60 to-transparent" />}
                        <span onPointerDown={(e) => drag(e, c, "l")} className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize" />
                        <span onPointerDown={(e) => drag(e, c, "r")} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize bg-white/20" />
                      </div>
                    ))}
                </div>
              </div>
            ))}
            <div className="absolute top-0 bottom-0 w-px bg-lime pointer-events-none" style={{ left: 120 + time * pps }} />
          </div>
        </div>
      </div>
    </div>
  );
}
