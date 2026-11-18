"use client";
import NextLink from "next/link";
import { useState } from "react";
import { modelById, useStudio } from "@/lib/store";
import { APERTURES, ASPECTS, CAMERAS, FOCALS, GENRES, LENSES, LIGHTING, MOVES, tempoLabel } from "@/lib/presets";
import { produceShot } from "@/lib/router";
import { compilePrompt, continuity } from "@/lib/engine";
import { planRoute, type PreflightLine } from "@/lib/bridge";
import type { CinemaSettings, RoutePlan, Shot } from "@/lib/types";
import { uid } from "@/lib/util";
import Scene from "../Scene";
import { At, Bars, Book, ChevronR, Close, Folder, Image as ImageIcon, Lock, Mic, Plus, Speaker, Spark, Wave } from "../Icons";
import { Chip, Select, Slider } from "../ui";
import { durationOptions, nearestRes, RefPicker, resolutionOptions, RouteSelector, ShotCard, Vault, type PickedRef } from "./shared";
import { nearest } from "@/lib/adapters";
import Preflight from "./Preflight";
import { useHydrated } from "../Hydrate";

type Tab = "create" | "optics" | "continuity";

function Row({ label, value, onClick, right }: { label: string; value: React.ReactNode; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <button onClick={onClick} className="w-full rounded-12 bg-w5 hover:bg-w10 px-3 py-2 flex items-center justify-between text-left min-h-[54px]">
      <span>
        <span className="block text-12 text-w50 font-semibold">{label}</span>
        <span className="block text-14 font-semibold">{value}</span>
      </span>
      {right ?? <ChevronR size={16} className="text-w50" />}
    </button>
  );
}

export function HowItWorks() {
  const cols = [
    { t: "Add image", b: "Upload or generate an image to start your animation", scene: "dusk", kind: "upload" },
    { t: "Choose preset", b: "Pick a camera preset to control your image movement", scene: "field", kind: "preset" },
    { t: "Get video", b: "Click generate and Claude compiles the perfect prompt", scene: "city", kind: "get" },
  ];
  return (
    <section className="px-8 py-24">
      <header className="flex flex-col gap-3">
        <h1 className="font-display font-bold uppercase text-40 leading-[48px] max-w-[260px] md:max-w-none">Make videos in one click</h1>
        <p className="text-14 text-w60 max-w-[300px] md:max-w-none">250+ presets for camera control, framing and high-quality VFX — or use the general preset for manual control.</p>
      </header>
      <div className="mt-10 grid grid-cols-3 gap-4 md:gap-10">
        {cols.map((c) => (
          <article key={c.t}>
            <div className="relative aspect-[300/228] rounded-16 overflow-hidden bg-ink-2 border border-w5">
              {c.kind === "upload" && (
                <div
                  className="absolute inset-[10%] rounded-12 border border-dashed border-w10 flex flex-col items-center justify-center gap-2"
                  style={{ background: "radial-gradient(ellipse at 22% 85%, #b9566c 0 14%, #2d2c5c 26%, transparent 34%)" }}
                >
                  <ImageIcon size={22} />
                  <span className="hidden md:block font-display font-bold text-14 lg:text-16">UPLOAD IMAGE</span>
                </div>
              )}
              {c.kind === "preset" && <Scene name="field" className="absolute top-[13%] bottom-[13%] left-[29%] right-[29%] rounded-8 border-2 border-lime" style={{ boxShadow: "-90px 0 0 -10px #3b2d1f88, 90px 0 0 -10px #50524f88" }} />}
              {c.kind === "get" && <Scene name="city" className="absolute inset-[5%] rounded-12 border-4 border-white" />}
            </div>
            <h2 className="mt-7 font-display font-bold uppercase text-20 leading-7">{c.t}</h2>
            <p className="mt-2 text-14 text-w60 leading-5">{c.b}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function CinemaStudio() {
  const st = useStudio();
  const hydrated = useHydrated();
  const [tab, setTab] = useState<Tab>("create");
  const [panel, setPanel] = useState<"history" | "how">("how");
  const [refMode, setRefMode] = useState<"refs" | "extend">("refs");
  const [firstPick, setFirstPick] = useState<PickedRef[]>([]);
  const [refPicks, setRefPicks] = useState<PickedRef[]>([]);
  const [sheet, setSheet] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ lines: PreflightLine[]; plan: RoutePlan } | null>(null);
  const [extend, setExtend] = useState({ back: 0, fwd: 0 });

  const s = st.settings;
  const model = modelById(st.models, st.modelId);
  const videoModels = st.models.filter((m) => m.kind === "video" && m.enabled);
  const setS = (p: Partial<CinemaSettings>) => st.set({ settings: { ...s, ...p } });
  const total = Math.min(30, s.duration + extend.back + extend.fwd);
  const est = Math.round(model.cost + model.costPerSecond * total);
  const prevShot = st.shots.find((x) => x.id === st.firstFrame);
  const firstRef = st.vault.find((r) => r.id === st.firstFrame);
  const endRef = st.vault.find((r) => r.id === st.endFrame);

  const run = async (plan?: RoutePlan) => {
    setBusy(true);
    setPanel("history");
    setSheet(false);
    const tempId = uid("tmp");
    const placeholder: Shot = {
      id: tempId,
      title: `Shot ${st.shots.length + 1}`,
      prompt: st.prompt,
      compiled: "",
      continuity: "",
      modelId: model.id,
      settings: s,
      refIds: st.refIds,
      castIds: st.castIds,
      extendBack: extend.back,
      extendForward: extend.fwd,
      status: "compiling",
      seed: Math.floor(Math.random() * 99999),
      credits: est,
      createdAt: Date.now(),
    };
    st.update("shots", (v) => [placeholder, ...v]);
    const shot = await produceShot(
      {
        title: placeholder.title,
        prompt: st.prompt,
        model,
        settings: { ...s, duration: s.duration },
        cast: st.cast.filter((c) => st.castIds.includes(c.id)),
        refs: st.vault.filter((r) => st.refIds.includes(r.id)),
        prev: prevShot,
        firstFrameUrl: prevShot?.resultUrl || firstRef?.dataUrl,
        lastFrameUrl: endRef?.dataUrl,
        media: [...firstPick.map((r) => ({ role: "first" as const, url: r.url })), ...refPicks.map((r) => ({ role: "ref" as const, url: r.url }))],
        extendBack: extend.back,
        extendForward: extend.fwd,
        plan,
      },
      (status, partial) => useStudio.getState().update("shots", (v) => v.map((x) => (x.id === tempId ? { ...x, status, ...partial } : x))),
    );
    useStudio.getState().update("shots", (v) => v.map((x) => (x.id === tempId ? shot : x)));
    if (st.autoChain && shot.status === "done") useStudio.getState().set({ firstFrame: shot.id });
    setBusy(false);
  };

  const generate = async () => {
    if (st.routeMode === "preflight") {
      setBusy(true);
      const plan = await planRoute(model, "preflight", st.lockPlatform, total);
      setBusy(false);
      setPending({ plan, lines: [{ label: st.prompt.slice(0, 60) || "Untitled shot", model, plan }] });
      return;
    }
    run();
  };

  const previewPrompt = async () => {
    setPreview("Claude is compiling…");
    const cont = await continuity(st.cast.filter((c) => st.castIds.includes(c.id)), st.vault.filter((r) => st.refIds.includes(r.id)), s, prevShot);
    const c = await compilePrompt(st.prompt, s, model, cont.value);
    setPreview(`${c.mode === "live" ? "Claude" : "Local engine"} → ${model.name}\n\n${c.value}`);
  };

  const toTimeline = (shot: Shot) => {
    st.update("clips", (clips) => {
      const end = clips.filter((c) => c.track === "video").reduce((a, c) => Math.max(a, c.start + c.duration), 0);
      return [
        ...clips,
        { id: uid("clip"), track: "video", start: end, duration: Math.min(30, shot.settings.duration + shot.extendBack + shot.extendForward), label: shot.title, shotId: shot.id, seed: shot.seed, transition: "cut", subtitle: shot.prompt.split(/[.!?]/)[0], url: shot.resultUrl },
      ];
    });
  };

  const left = (
    <div className="h-full flex flex-col rounded-16 bg-[#262d32] border border-w5 overflow-hidden">
      <div className="flex items-end gap-3 px-2 border-b border-w5">
        {(
          [
            ["create", "Create Video"],
            ["optics", "Optical Stack"],
            ["continuity", "Continuity"],
          ] as [Tab, string][]
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-[46px] px-1 text-14 font-medium border-b-2 ${tab === k ? "border-white text-white" : "border-transparent text-w50"}`}>
            {l}
          </button>
        ))}
        <button aria-label="Close controls" onClick={() => setSheet(false)} className="md:hidden ml-auto mb-3">
          <Close size={18} />
        </button>
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-2 flex flex-col gap-2">
        {tab === "create" && (
          <>
            <Scene name="cafe" className="h-[130px] rounded-12 shrink-0">
              <button onClick={() => setTab("optics")} className="absolute right-2 top-2 h-7 px-2.5 rounded-8 bg-[#00000099] text-12 font-semibold">
                ✎ Change
              </button>
              <span className="absolute left-3 bottom-6 font-display font-bold text-20 text-lime uppercase">{s.genre === "Drama" ? "General" : s.genre}</span>
              <span className="absolute left-3 bottom-2.5 text-12 text-white/80">
                {model.name} · {s.camera}
              </span>
            </Scene>
            <div className="grid grid-cols-2 gap-1 p-0.5 rounded-10 bg-w5 shrink-0">
              <button onClick={() => setRefMode("refs")} className={`h-[33px] rounded-8 text-12 font-semibold ${refMode === "refs" ? "bg-w10" : "text-w50"}`}>
                ⧉ References
              </button>
              <button onClick={() => setRefMode("extend")} className={`h-[33px] rounded-8 text-12 font-semibold ${refMode === "extend" ? "bg-w10" : "text-w50"}`}>
                ⇥ Extend Video
              </button>
            </div>
            {refMode === "refs" ? (
              <button onClick={() => setTab("continuity")} className="shrink-0 h-[166px] rounded-12 border border-dashed border-w10 bg-w5 flex flex-col items-center justify-center gap-2">
                <span className="flex -space-x-1.5">
                  {[ImageIcon, Wave, Speaker].map((I, k) => (
                    <span key={k} className="w-8 h-8 rounded-full bg-[#36404a] border border-w10 grid place-items-center">
                      <I size={12} />
                    </span>
                  ))}
                </span>
                <span className="text-14 font-semibold mt-2">{st.refIds.length ? `${st.refIds.length} references linked` : "Add references"}</span>
                <span className="text-12 text-mute">Image, Video or Audio · up to 50</span>
              </button>
            ) : (
              <div className="shrink-0 rounded-12 bg-w5 p-3 flex flex-col gap-3">
                <Slider label="Extend backward" min={0} max={Math.max(0, 30 - s.duration - extend.fwd)} value={extend.back} onChange={(v) => setExtend({ ...extend, back: v })} display={`${extend.back}s`} />
                <Slider label="Extend forward" min={0} max={Math.max(0, 30 - s.duration - extend.back)} value={extend.fwd} onChange={(v) => setExtend({ ...extend, fwd: v })} display={`${extend.fwd}s`} />
                <p className="text-12 text-w50">Scene length: {total}s of 30s max</p>
              </div>
            )}
            <div className="shrink-0 rounded-12 bg-w5 p-3 flex flex-col gap-2 text-12">
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-semibold text-w60">First frame</span>
                <RefPicker refs={firstPick} onChange={setFirstPick} max={1} label="First frame" drop="down" />
              </div>
              <div className="flex items-center gap-2">
                <span className="w-20 shrink-0 font-semibold text-w60">References</span>
                <RefPicker refs={refPicks} onChange={setRefPicks} max={10} drop="down" />
              </div>
            </div>
            <div className="shrink-0 rounded-12 bg-w5 p-3">
              <p className="text-14 font-semibold">Prompt</p>
              <textarea
                aria-label="Prompt"
                value={st.prompt}
                onChange={(e) => st.set({ prompt: e.target.value })}
                placeholder="Describe the shot you want — e.g. “Maya walks the pier at golden hour, scanning the boats”. Claude adds camera, lens and continuity details."
                className="mt-2 w-full h-[84px] bg-transparent resize-none outline-none text-14 leading-5 placeholder:text-w50"
              />
              <div className="flex gap-1.5">
                <button onClick={previewPrompt} className="h-7 px-2 rounded-8 bg-w5 text-12 font-semibold flex items-center gap-1">
                  <At size={12} /> Compile
                </button>
                <button onClick={() => setS({ audio: !s.audio })} className="h-7 px-2 rounded-8 bg-w5 text-12 font-semibold flex items-center gap-1">
                  <Speaker size={12} /> {s.audio ? "On" : "Off"}
                </button>
              </div>
              {preview && <pre className="mt-2 whitespace-pre-wrap text-[11px] leading-4 text-w60 bg-black/30 rounded-8 p-2 max-h-[180px] overflow-y-auto thin-scroll">{preview}</pre>}
            </div>
            <div className="shrink-0 rounded-12 bg-w5 px-3 py-2 relative">
              <span className="block text-12 text-w50 font-semibold">Model</span>
              <div className="flex items-center gap-1.5">
                <Select label="Video model" value={st.modelId} onChange={(v) => st.set({ modelId: v })} options={videoModels.map((m) => ({ id: m.id, label: `${m.name}${m.tier === "draft" ? " · draft" : ""}` }))} />
                <Bars size={14} className="text-lime shrink-0" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="rounded-12 bg-w5 px-3 py-2">
                <span className="block text-12 text-w50 font-semibold">Duration</span>
                <Select label="Duration" value={String(nearest(s.duration, durationOptions(model)))} onChange={(v) => setS({ duration: Number(v) })} options={durationOptions(model).map((d) => ({ id: String(d), label: `${d}s` }))} />
              </div>
              <div className="rounded-12 bg-w5 px-3 py-2">
                <span className="block text-12 text-w50 font-semibold">Resolution</span>
                <Select label="Video resolution" value={nearestRes(s.resolution, resolutionOptions(model))} onChange={(v) => setS({ resolution: v })} options={resolutionOptions(model)} />
              </div>
              <div className="rounded-12 bg-w5 px-3 py-2">
                <span className="block text-12 text-w50 font-semibold">Aspect Ratio</span>
                <Select label="Aspect ratio" value={s.aspect} onChange={(v) => setS({ aspect: v })} options={ASPECTS.map((a) => ({ id: a.id, label: a.label }))} />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 shrink-0">
              {ASPECTS.map((a) => (
                <button key={a.id} title={a.hint} onClick={() => setS({ aspect: a.id })} className={`h-9 rounded-8 text-12 font-semibold ${s.aspect === a.id ? "bg-white text-dark" : "bg-w5"}`}>
                  {a.label}
                </button>
              ))}
            </div>
            <div className="shrink-0 rounded-12 bg-w5 p-3">
              <p className="text-12 text-w50 font-semibold mb-2">Credit routing</p>
              <RouteSelector modelId={st.modelId} mode={st.routeMode} lock={st.lockPlatform} onChange={(m, l) => st.set({ routeMode: m, lockPlatform: l })} />
            </div>
          </>
        )}
        {tab === "optics" && (
          <>
            <div className="rounded-12 bg-w5 p-3 grid grid-cols-2 gap-3">
              <label className="col-span-2">
                <span className="text-12 text-w50 font-semibold">Camera body</span>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {CAMERAS.slice(0, 4).map((c) => (
                    <Chip key={c} active={s.camera === c} onClick={() => setS({ camera: c })}>
                      {c}
                    </Chip>
                  ))}
                </div>
                <div className="mt-1 rounded-8 bg-w5 px-2 h-8 flex items-center">
                  <Select label="More cameras" value={s.camera} onChange={(v) => setS({ camera: v })} options={CAMERAS} className="text-12" />
                </div>
              </label>
              <label className="col-span-2">
                <span className="text-12 text-w50 font-semibold">Lens</span>
                <div className="mt-1 grid grid-cols-3 gap-1">
                  {LENSES.slice(0, 3).map((c) => (
                    <Chip key={c} active={s.lens === c} onClick={() => setS({ lens: c })}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </label>
              <div className="col-span-2">
                <Slider label="Aperture" min={0} max={APERTURES.length - 1} value={APERTURES.indexOf(s.aperture)} onChange={(i) => setS({ aperture: APERTURES[i] })} display={s.aperture} />
              </div>
              <div className="col-span-2">
                <Slider label="Focal length" min={0} max={FOCALS.length - 1} value={Math.max(0, FOCALS.indexOf(s.focal))} onChange={(i) => setS({ focal: FOCALS[i] })} display={`${s.focal}mm`} />
              </div>
            </div>
            <div className="rounded-12 bg-w5 p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-12 text-w50 font-semibold">Multi-axis motion</span>
                <button disabled={s.moves.length >= 3} onClick={() => setS({ moves: [...s.moves, { type: "Orbit", amount: 50 }] })} className="text-12 font-semibold flex items-center gap-1 disabled:opacity-30">
                  <Plus size={12} /> Add axis
                </button>
              </div>
              {s.moves.map((m, i) => (
                <div key={i} className="rounded-8 bg-black/20 p-2">
                  <div className="flex items-center gap-2">
                    <Select label={`Move ${i + 1}`} value={m.type} onChange={(v) => setS({ moves: s.moves.map((x, k) => (k === i ? { ...x, type: v } : x)) })} options={MOVES} className="text-12" />
                    {s.moves.length > 1 && (
                      <button aria-label="Remove move" onClick={() => setS({ moves: s.moves.filter((_, k) => k !== i) })}>
                        <Close size={12} />
                      </button>
                    )}
                  </div>
                  <input aria-label="Move intensity" type="range" min={0} max={100} value={m.amount} onChange={(e) => setS({ moves: s.moves.map((x, k) => (k === i ? { ...x, amount: Number(e.target.value) } : x)) })} className="w-full accent-[#8db600]" />
                </div>
              ))}
              <Slider label="Scene tempo" min={0} max={100} value={s.tempo} onChange={(v) => setS({ tempo: v })} display={tempoLabel(s.tempo)} />
            </div>
            <div className="rounded-12 bg-w5 p-3 grid grid-cols-2 gap-2">
              <div>
                <span className="text-12 text-w50 font-semibold">Lighting</span>
                <Select label="Lighting" value={s.lighting} onChange={(v) => setS({ lighting: v })} options={LIGHTING} />
              </div>
              <div>
                <span className="text-12 text-w50 font-semibold">Genre</span>
                <Select label="Genre" value={s.genre} onChange={(v) => setS({ genre: v })} options={GENRES} />
              </div>
              <div>
                <span className="text-12 text-w50 font-semibold">Resolution</span>
                <Select label="Resolution" value={nearestRes(s.resolution, resolutionOptions(model))} onChange={(v) => setS({ resolution: v })} options={resolutionOptions(model)} />
              </div>
            </div>
          </>
        )}
        {tab === "continuity" && (
          <>
            <div className="rounded-12 bg-w5 p-3 flex flex-col gap-2">
              <p className="text-14 font-semibold">Frame locking</p>
              <div className="grid grid-cols-2 gap-1.5">
                <div className="rounded-10 bg-black/20 p-2 min-h-[86px]">
                  <p className="text-12 text-w50 font-semibold">First frame</p>
                  <Select
                    label="First frame"
                    value={st.firstFrame || ""}
                    onChange={(v) => st.set({ firstFrame: v || undefined })}
                    options={[{ id: "", label: "None" }, ...st.shots.filter((x) => x.status === "done").map((x) => ({ id: x.id, label: `Last frame of ${x.title}` })), ...st.vault.filter((r) => r.kind !== "audio").map((r) => ({ id: r.id, label: r.name }))]}
                    className="text-12"
                  />
                </div>
                <div className="rounded-10 bg-black/20 p-2 min-h-[86px]">
                  <p className="text-12 text-w50 font-semibold">End frame</p>
                  <Select label="End frame" value={st.endFrame || ""} onChange={(v) => st.set({ endFrame: v || undefined })} options={[{ id: "", label: "None" }, ...st.vault.filter((r) => r.kind !== "audio").map((r) => ({ id: r.id, label: r.name }))]} className="text-12" />
                  {!model.capabilities.includes("first_last") && <p className="text-[10px] text-[#ff5c9a] mt-1">{model.name} has no end-frame control</p>}
                </div>
              </div>
              <label className="flex items-center gap-2 text-12">
                <input type="checkbox" checked={st.autoChain} onChange={(e) => st.set({ autoChain: e.target.checked })} className="accent-[#8db600]" />
                Auto-chain: each new shot starts on the last frame of the previous one
              </label>
            </div>
            <div className="rounded-12 bg-w5 p-3 flex flex-col gap-2">
              <p className="text-14 font-semibold">Cast in this shot</p>
              <div className="flex flex-wrap gap-1.5">
                {st.cast.map((c) => (
                  <Chip key={c.id} active={st.castIds.includes(c.id)} onClick={() => st.set({ castIds: st.castIds.includes(c.id) ? st.castIds.filter((x) => x !== c.id) : [...st.castIds, c.id] })}>
                    {c.locked && <Lock size={10} />} {c.name}
                  </Chip>
                ))}
                <NextLink href="/short-drama/" className="h-8 px-2.5 rounded-8 text-12 font-semibold text-w50 flex items-center">
                  Edit cast →
                </NextLink>
              </div>
            </div>
            <div className="rounded-12 bg-w5 p-3">
              <Vault selected={st.refIds} onToggle={(id) => st.set({ refIds: st.refIds.includes(id) ? st.refIds.filter((x) => x !== id) : [...st.refIds, id] })} />
            </div>
          </>
        )}
      </div>
      <div className="p-2 pt-0">
        <button disabled={busy || !hydrated} onClick={generate} className="btn-lime w-full h-[46px] rounded-12 text-16 font-medium flex items-center justify-center gap-2 disabled:opacity-60">
          {busy ? "Working…" : "Generate"} <Spark size={14} /> {est}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex gap-2 md:h-[calc(100vh-84px)] md:min-h-[600px] px-2 md:px-4 md:pb-[38px] pb-24">
      <aside className={`${sheet ? "fixed inset-0 z-50 p-2 bg-ink" : "hidden"} md:static md:block md:w-[320px] md:shrink-0 md:p-0`}>{left}</aside>
      <div className="flex-1 min-w-0 rounded-16 border border-w10 flex flex-col overflow-hidden min-h-[720px] md:min-h-0">
        <header className="flex items-center gap-3 mx-2.5 pt-2 pb-3">
        <nav aria-label="Panel" className="flex items-center gap-1.5">
          <button onClick={() => setPanel("history")} className={`h-8 px-2 rounded-8 text-12 font-semibold flex items-center gap-1.5 ${panel === "history" ? "bg-w10" : "text-w60"}`}>
            <Folder size={14} /> History {hydrated && st.shots.length > 0 && <span className="text-w50">{st.shots.length}</span>}
          </button>
          <button onClick={() => setPanel("how")} className={`h-8 px-2 rounded-8 text-12 font-semibold flex items-center gap-1.5 ${panel === "how" ? "bg-w10" : "text-w60"}`}>
            <Book size={14} /> How it works
          </button>
        </nav>
          <NextLink href="/canvas/" className="ml-auto h-8 px-2 rounded-8 text-12 font-semibold text-w60 hidden md:flex items-center gap-1.5">
            Open in canvas →
          </NextLink>
        </header>
        <div className="thin-scroll flex-1 overflow-y-auto">
          {panel === "how" || !hydrated || st.shots.length === 0 ? (
            <HowItWorks />
          ) : (
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {st.shots.map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  onRerun={() => {
                    st.set({ prompt: shot.prompt, settings: shot.settings, modelId: shot.modelId });
                    setTimeout(run, 0);
                  }}
                  onChain={() => st.set({ firstFrame: shot.id, prompt: "" })}
                  onTimeline={() => toTimeline(shot)}
                  onDelete={() => st.update("shots", (v) => v.filter((x) => x.id !== shot.id))}
                />
              ))}
            </div>
          )}
        </div>
        <div className="hidden md:flex items-center gap-4 border-t border-w5 px-4 h-16 shrink-0">
          <div className="flex -space-x-3">
            {["portrait", "dusk", "cafe"].map((n, k) => (
              <Scene key={n} name={n} className="w-11 h-11 rounded-8 border-2 border-ink" style={{ transform: `rotate(${(k - 1) * 8}deg)` }} />
            ))}
          </div>
          <div>
            <p className="text-16 font-semibold">Don&apos;t know where to start?</p>
            <p className="text-12 text-w50">Write a story in Drama Studio and let the Showrunner plan the shots</p>
          </div>
          <NextLink href="/short-drama/" className="ml-auto h-8 px-3 rounded-full bg-white text-dark text-12 font-semibold flex items-center">
            Open Drama Studio
          </NextLink>
        </div>
      </div>
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 p-3 bg-gradient-to-t from-ink to-transparent flex gap-2">
        <button onClick={() => setSheet(true)} className="h-12 px-4 rounded-12 bg-w10 text-14 font-semibold flex items-center gap-2">
          <Mic size={14} /> Controls
        </button>
        <button onClick={generate} className="btn-lime flex-1 h-12 rounded-12 text-16 font-semibold">
          Generate · {est}
        </button>
      </div>
      <Preflight
        lines={pending?.lines || null}
        onCancel={() => setPending(null)}
        onApprove={() => {
          const p = pending!.plan;
          setPending(null);
          run(p);
        }}
      />
    </div>
  );
}
