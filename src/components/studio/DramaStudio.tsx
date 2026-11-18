"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { modelById, useStudio } from "@/lib/store";
import { breakdownScript } from "@/lib/engine";
import { readScriptFile, SCRIPT_ACCEPT } from "@/lib/scriptImport";
import { planRoute, type PreflightLine } from "@/lib/bridge";
import { produceShot } from "@/lib/router";
import type { CastMember, Episode, RoutePlan, Shot } from "@/lib/types";
import { artGradient, fileToDataUrl, uid } from "@/lib/util";
import { Brain, Film, Lock, Mic, Plus, Spark, Trash, Unlock } from "../Icons";
import { Badge, Input, Select, TextArea } from "../ui";
import Timeline from "./Timeline";
import Preflight from "./Preflight";
import { RouteSelector } from "./shared";
import { useHydrated } from "../Hydrate";

const EMO_COLOR: Record<string, string> = { Dread: "#b28dff", Confrontation: "#ff5c9a", Resolve: "#8db600", Longing: "#7cc4ff", Joy: "#ffd25c", Curiosity: "#ffb347", Neutral: "#888" };
/** Colour for any emotion label, including free text such as "Suspense and guilt": nearest of the fixed emotions by keyword. */
const EMO_WORDS: [string, RegExp][] = [
  ["Dread", /dread|fear|terror|suspense|tense|tension|anxi|guilt|unease|menace|horror/i],
  ["Confrontation", /confront|anger|angry|rage|conflict|betray|fight|accus|hostil/i],
  ["Resolve", /resolve|determin|courage|defian|hope|resolution|triumph/i],
  ["Longing", /long|grief|sad|sorrow|melanchol|nostalg|regret|lonel|loss|wistful/i],
  ["Joy", /joy|happy|love|warm|relief|delight|romance|tender/i],
  ["Curiosity", /curio|myster|intrigu|wonder|discover|search/i],
];
const emoColor = (e: string) => EMO_COLOR[e] || EMO_COLOR[EMO_WORDS.find(([, r]) => r.test(e))?.[0] || "Neutral"];

function CastEditor({ c }: { c: CastMember }) {
  const update = useStudio((s) => s.update);
  const vault = useStudio((s) => s.vault);
  const file = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<CastMember>) => update("cast", (v) => v.map((x) => (x.id === c.id ? { ...x, ...p } : x)));
  const face = vault.find((r) => r.id === c.faceRefId);
  const speak = () => {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(`I'm ${c.name}. ${c.voice.style}.`);
    u.pitch = c.voice.pitch;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  return (
    <div className="flex flex-col gap-3 text-12">
      <div className="flex gap-3">
        <button onClick={() => file.current?.click()} className="w-[72px] h-[88px] rounded-12 shrink-0 border border-w10 relative overflow-hidden" style={{ background: face?.dataUrl ? `center/cover url(${face.dataUrl})` : artGradient(c.name.length * 41) }} title="Upload face anchor">
          <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] py-0.5">Face anchor</span>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const dataUrl = await fileToDataUrl(f);
            const id = uid("ref");
            update("vault", (v) => [...v, { id, kind: "character", name: `${c.name} face`, description: c.face, dataUrl, tags: ["face anchor"], createdAt: Date.now() }]);
            patch({ faceRefId: id });
          }}
        />
        <div className="flex-1 flex flex-col gap-1.5">
          <Input aria-label="Name" value={c.name} onChange={(e) => patch({ name: e.target.value })} />
          <Input aria-label="Role" value={c.role} onChange={(e) => patch({ role: e.target.value })} />
          <button onClick={() => patch({ locked: !c.locked })} className={`h-8 rounded-8 font-semibold flex items-center justify-center gap-1.5 ${c.locked ? "bg-lime text-dark" : "bg-w10"}`}>
            {c.locked ? <Lock size={12} /> : <Unlock size={12} />} {c.locked ? "Locked across all scenes" : "Unlocked"}
          </button>
        </div>
      </div>
      <label>
        <span className="text-w50 font-semibold">Face anchor descriptors</span>
        <TextArea value={c.face} onChange={(e) => patch({ face: e.target.value })} rows={2} />
      </label>
      <div>
        <div className="flex items-center justify-between">
          <span className="text-w50 font-semibold">Wardrobe variations</span>
          <button onClick={() => patch({ wardrobe: [...c.wardrobe, { id: uid("w"), name: `Look ${c.wardrobe.length + 1}`, description: "" }] })} className="flex items-center gap-1 font-semibold">
            <Plus size={10} /> Add
          </button>
        </div>
        <div className="mt-1 flex flex-col gap-1.5">
          {c.wardrobe.map((w) => (
            <div key={w.id} className={`rounded-8 p-2 border ${c.activeWardrobe === w.id ? "border-lime bg-[#8db6000d]" : "border-w5 bg-w5"}`}>
              <div className="flex items-center gap-2">
                <input type="radio" aria-label={`Use ${w.name}`} checked={c.activeWardrobe === w.id} onChange={() => patch({ activeWardrobe: w.id })} className="accent-[#8db600]" />
                <input aria-label="Wardrobe name" value={w.name} onChange={(e) => patch({ wardrobe: c.wardrobe.map((x) => (x.id === w.id ? { ...x, name: e.target.value } : x)) })} className="flex-1 bg-transparent outline-none font-semibold" />
                <button aria-label="Remove wardrobe" onClick={() => patch({ wardrobe: c.wardrobe.filter((x) => x.id !== w.id) })}>
                  <Trash size={10} />
                </button>
              </div>
              <input aria-label="Wardrobe description" placeholder="e.g. charcoal trench coat, wet hair" value={w.description} onChange={(e) => patch({ wardrobe: c.wardrobe.map((x) => (x.id === w.id ? { ...x, description: e.target.value } : x)) })} className="mt-1 w-full bg-transparent outline-none text-w60" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-8 bg-w5 p-2 flex flex-col gap-1.5">
        <span className="text-w50 font-semibold">Voice profile</span>
        <input aria-label="Voice name" value={c.voice.name} onChange={(e) => patch({ voice: { ...c.voice, name: e.target.value } })} className="bg-transparent outline-none font-semibold" />
        <input aria-label="Voice style" value={c.voice.style} onChange={(e) => patch({ voice: { ...c.voice, style: e.target.value } })} className="bg-transparent outline-none text-w60" />
        <label className="flex items-center gap-2">
          Pitch
          <input type="range" min={0.5} max={1.5} step={0.05} value={c.voice.pitch} onChange={(e) => patch({ voice: { ...c.voice, pitch: Number(e.target.value) } })} className="flex-1 accent-[#8db600]" />
          <button onClick={speak} className="h-6 px-2 rounded-6 bg-w10 font-semibold flex items-center gap-1">
            <Mic size={10} /> Preview
          </button>
        </label>
      </div>
      <label>
        <span className="text-w50 font-semibold">Visual style tags</span>
        <Input value={c.styleTags.join(", ")} onChange={(e) => patch({ styleTags: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
      </label>
    </div>
  );
}

export default function DramaStudio() {
  const st = useStudio();
  const hydrated = useHydrated();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [castSel, setCastSel] = useState("cast_maya");
  const [pending, setPending] = useState<{ lines: (PreflightLine & { shot: { prompt: string; title: string; chars: string[] } })[] } | null>(null);
  const [batchMsg, setBatchMsg] = useState("");
  const ep = st.episodes.find((e) => e.id === st.activeEpisode) || st.episodes[0];
  const patchEp = (p: Partial<Episode>) => st.update("episodes", (v) => v.map((e) => (e.id === ep.id ? { ...e, ...p, updatedAt: Date.now() } : e)));
  const model = modelById(st.models, st.modelId);
  const cSel = st.cast.find((c) => c.id === castSel) || st.cast[0];

  const scriptFile = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const importScript = async (f: File) => {
    setImporting(true);
    setImportMsg("");
    try {
      const text = await readScriptFile(f);
      const base = f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
      // a fresh script replaces the old breakdown, which no longer matches it
      patchEp({ script: text, scenes: [], logline: "", ...(/^Episode \d+$/.test(ep.title) || !ep.title.trim() ? { title: base } : {}) });
      setImportMsg(`Loaded ${f.name} (${text.split(/\s+/).length.toLocaleString()} words). Now break it down with Claude.`);
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : String(e));
    }
    setImporting(false);
  };

  const breakdown = async () => {
    if (!ep.script.trim()) {
      setImportMsg("Paste a script or story idea, or upload a script file, first.");
      return;
    }
    setBusy(true);
    const r = await breakdownScript(ep.script, st.cast);
    patchEp({ ...r.value, title: ep.title, engine: r.mode });
    setBusy(false);
  };

  const sendToCanvas = () => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const baseY = Math.max(0, ...st.nodes.map((n) => n.position.y)) + 400;
    const charNodes: Record<string, string> = {};
    st.cast.forEach((c, i) => {
      const id = uid("n");
      charNodes[c.name.toLowerCase()] = id;
      nodes.push({ id, type: "character", position: { x: 0, y: baseY + i * 260 }, data: { castId: c.id } });
    });
    let x = 420;
    ep.scenes.forEach((sc) => {
      let prev: string | null = null;
      sc.shots.forEach((sp, k) => {
        const id = uid("n");
        nodes.push({ id, type: "shot", position: { x, y: baseY + k * 420 }, data: { title: `${sc.title.split(":")[0]} · ${sp.shotType}`, prompt: `${sp.description}. ${sp.movement} camera. Emotion: ${sc.emotion}.`, modelId: st.modelId, routeMode: "cheapest" } });
        sp.characters.forEach((name) => charNodes[name.toLowerCase()] && edges.push({ id: uid("e"), source: charNodes[name.toLowerCase()], target: id, animated: true }));
        if (prev) edges.push({ id: uid("e"), source: prev, target: id, animated: true, label: "last frame → first frame" });
        prev = id;
      });
      x += 380;
    });
    st.update("nodes", (v) => [...v, ...nodes]);
    st.update("edges", (v) => [...v, ...edges]);
    router.push("/canvas/");
  };

  const sendToTimeline = () => {
    const clips: typeof st.clips = [];
    let t = 0;
    ep.scenes.forEach((sc) => {
      sc.shots.forEach((sp) => {
        clips.push({ id: uid("clip"), track: "video", start: t, duration: sp.duration, label: `${sc.location} · ${sp.shotType}`, seed: Math.floor(t * 7 + sp.duration * 13), transition: t === 0 ? "fade" : "cut", subtitle: "" });
        t += sp.duration;
      });
    });
    let d = 0.5;
    ep.scenes.forEach((sc) =>
      sc.dialogue.forEach((l) => {
        const dur = Math.max(1.5, l.line.split(" ").length / 2.6);
        clips.push({ id: uid("clip"), track: "dialogue", start: d, duration: dur, label: `${l.character.toUpperCase()}: ${l.line}`, seed: 3, transition: "cut", subtitle: l.line });
        d += dur + 1.2;
      }),
    );
    clips.push({ id: uid("clip"), track: "music", start: 0, duration: t, label: `${ep.title} — score`, seed: 9, transition: "fade" });
    st.set({ clips, timelineOpen: true });
    document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth" });
  };

  const renderAll = async () => {
    const shots = ep.scenes.flatMap((sc) => sc.shots.map((sp) => ({ title: `${sc.title.split(":")[0]} · ${sp.shotType}`, prompt: `${sp.description}. Emotion: ${sc.emotion}.`, chars: sp.characters })));
    setBatchMsg("Claude is planning credit routes…");
    // Every shot here uses the same model, routing mode and duration, so one route plan covers them all (was one Claude call per shot).
    const mode = st.routeMode === "lock" ? "lock" : "cheapest";
    const plans = new Map<string, RoutePlan>();
    const lines = [];
    for (const s of shots) {
      const key = `${model.id}|${mode}|${st.lockPlatform}|${st.settings.duration}`;
      if (!plans.has(key)) plans.set(key, await planRoute(model, mode, st.lockPlatform, st.settings.duration));
      lines.push({ label: s.title, model, plan: plans.get(key)!, shot: s });
    }
    setBatchMsg("");
    setPending({ lines });
  };

  const approve = async () => {
    const lines = pending!.lines;
    setPending(null);
    let prev: Shot | undefined;
    let n = 0;
    for (const l of lines) {
      setBatchMsg(`Rendering ${++n}/${lines.length} via ${l.plan.platformId ? st.platforms.find((p) => p.id === l.plan.platformId)?.name : "direct API"}…`);
      const shot = await produceShot({ title: l.shot.title, prompt: l.shot.prompt, model, settings: st.settings, cast: st.cast.filter((c) => l.shot.chars.map((x) => x.toLowerCase()).includes(c.name.toLowerCase())), refs: [], prev, plan: l.plan });
      useStudio.getState().update("shots", (v) => [shot, ...v]);
      prev = shot;
    }
    setBatchMsg(`Done: ${lines.length} shots added to Cinema Studio history.`);
  };

  if (!hydrated) return <div className="h-[60vh] grid place-items-center text-w40">Loading Drama Studio…</div>;

  return (
    <div className="flex flex-col min-h-[calc(100vh-36px)]">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_340px] gap-2 p-2">
        {/* episodes + cast list */}
        <aside className="rounded-16 bg-[#262d32] border border-w5 p-3 flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-14 font-semibold">Episodes</h2>
              <button
                onClick={() => {
                  const e: Episode = { id: uid("ep"), title: `Episode ${st.episodes.length + 1}`, logline: "", script: "", scenes: [], updatedAt: Date.now() };
                  st.set({ episodes: [...st.episodes, e], activeEpisode: e.id });
                }}
                className="text-12 font-semibold flex items-center gap-1"
              >
                <Plus size={10} /> New
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {st.episodes.map((e) => (
                <li key={e.id}>
                  <button onClick={() => st.set({ activeEpisode: e.id })} className={`w-full text-left rounded-8 px-2 py-1.5 text-12 ${e.id === ep.id ? "bg-w10 font-semibold" : "text-w60 hover:bg-w5"}`}>
                    {e.title}
                    <span className="block text-[10px] text-w40">{e.scenes.length} scenes</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-14 font-semibold">Cast & Wardrobe</h2>
              <button
                onClick={() => {
                  const c: CastMember = { id: uid("cast"), name: "New character", role: "Supporting", face: "", wardrobe: [{ id: uid("w"), name: "Default", description: "" }], activeWardrobe: "", voice: { name: "Neutral", style: "natural", pitch: 1 }, styleTags: [], locked: false, color: "#7cc4ff" };
                  c.activeWardrobe = c.wardrobe[0].id;
                  st.update("cast", (v) => [...v, c]);
                  setCastSel(c.id);
                }}
                className="text-12 font-semibold flex items-center gap-1"
              >
                <Plus size={10} /> Add
              </button>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {st.cast.map((c) => (
                <li key={c.id}>
                  <button onClick={() => setCastSel(c.id)} className={`w-full flex items-center gap-2 rounded-8 px-2 py-1.5 text-12 ${c.id === cSel?.id ? "bg-w10 font-semibold" : "text-w60 hover:bg-w5"}`}>
                    <span className="w-6 h-6 rounded-full shrink-0" style={{ background: artGradient(c.name.length * 41) }} />
                    <span className="flex-1 text-left truncate">{c.name}</span>
                    {c.locked && <Lock size={10} className="text-lime" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-12 bg-w5 p-2.5">
            <p className="text-12 font-semibold mb-1.5">Batch routing</p>
            <RouteSelector mode={st.routeMode} lock={st.lockPlatform} onChange={(m, l) => st.set({ routeMode: m, lockPlatform: l })} />
            <p className="text-[10px] text-w40 mt-1.5">Batch renders always show a pre-flight cost check first.</p>
          </div>
        </aside>

        {/* script + breakdown */}
        <section className="rounded-16 bg-[#262d32] border border-w5 p-3 flex flex-col gap-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <input aria-label="Episode title" value={ep.title} onChange={(e) => patchEp({ title: e.target.value })} className="flex-1 min-w-[200px] bg-transparent outline-none font-display font-bold text-24" />
            <button disabled={busy} onClick={breakdown} className="btn-lime h-10 px-4 rounded-10 text-14 font-semibold flex items-center gap-2 disabled:opacity-60">
              <Brain size={14} /> {busy ? "Showrunner is working…" : "Break down with Claude"}
            </button>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) importScript(f);
            }}
            className="flex flex-wrap items-center gap-2 rounded-12 border border-dashed border-w10 px-3 py-2 text-12 text-w60"
          >
            <button onClick={() => scriptFile.current?.click()} disabled={importing} className="h-8 px-3 rounded-8 bg-w10 text-white font-semibold disabled:opacity-60">
              {importing ? "Reading script…" : "Upload your script"}
            </button>
            <span>PDF, DOCX, FDX, TXT or MD · up to 10 MB · or drop the file here</span>
            {importMsg && <span className={importMsg.startsWith("Loaded") ? "text-lime" : "text-[#ff5c9a]"}>{importMsg}</span>}
            <input
              ref={scriptFile}
              type="file"
              accept={SCRIPT_ACCEPT}
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) importScript(f);
              }}
            />
          </div>
          <TextArea aria-label="Script or story idea" value={ep.script} onChange={(e) => patchEp({ script: e.target.value })} placeholder="Paste a screenplay (INT./EXT. headings, NAME: dialogue) or just describe a story idea in a few sentences." className="font-mono text-12 leading-5 h-[220px]" />
          {ep.scenes.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={ep.engine === "live" ? "lime" : "gray"}>{ep.engine === "live" ? `Claude · ${st.claudeModel}` : "Local engine"}</Badge>
                <p className="text-12 text-w60 flex-1 min-w-[200px]">{ep.logline}</p>
                <button onClick={sendToCanvas} className="h-8 px-3 rounded-8 bg-w10 text-12 font-semibold">
                  Send to canvas
                </button>
                <button onClick={sendToTimeline} className="h-8 px-3 rounded-8 bg-w10 text-12 font-semibold flex items-center gap-1">
                  <Film size={12} /> Assemble timeline
                </button>
                <button onClick={renderAll} className="h-8 px-3 rounded-8 bg-white text-dark text-12 font-semibold flex items-center gap-1">
                  <Spark size={12} /> Render all shots
                </button>
              </div>
              {batchMsg && <p className="text-12 text-lime">{batchMsg}</p>}
              <div>
                <p className="text-12 text-w50 font-semibold mb-1">Emotional arc</p>
                <div className="flex items-end gap-1 h-[90px] rounded-12 bg-w5 p-2">
                  {ep.scenes.map((sc) => (
                    <div key={sc.id} className="flex-1 flex flex-col items-center justify-end gap-1 h-full" title={`${sc.title}: ${sc.emotion} ${sc.intensity}/10`}>
                      <div className="w-full rounded-6" style={{ height: `${Math.max(8, Math.min(10, Number(sc.intensity) || 0) * 10)}%`, background: emoColor(sc.emotion) }} />
                      <span className="text-[9px] text-w50 truncate max-w-full">{sc.emotion}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {ep.scenes.map((sc, i) => (
                  <article key={sc.id} className="rounded-12 bg-w5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-14 font-semibold">{sc.title}</h3>
                      <Badge>{sc.beat}</Badge>
                      <span className="text-[10px] font-semibold rounded-6 px-1.5 py-0.5 text-dark" style={{ background: emoColor(sc.emotion) }}>
                        {sc.emotion} · {sc.intensity}/10
                      </span>
                    </div>
                    <p className="mt-1 text-12 text-w60">{sc.summary}</p>
                    {sc.dialogue.length > 0 && (
                      <div className="mt-2 flex flex-col gap-0.5">
                        {sc.dialogue.map((d, k) => (
                          <p key={k} className="text-12">
                            <span className="font-semibold text-lime">{d.character}:</span> {d.line}
                          </p>
                        ))}
                      </div>
                    )}
                    <table className="mt-2 w-full text-[11px]">
                      <thead className="text-w40 text-left">
                        <tr>
                          <th className="font-medium py-1">#</th>
                          <th className="font-medium">Shot</th>
                          <th className="font-medium">Type</th>
                          <th className="font-medium">Move</th>
                          <th className="font-medium text-right">Sec</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sc.shots.map((sp, k) => (
                          <tr key={sp.id} className="border-t border-w5">
                            <td className="py-1 pr-2 text-w40">
                              {i + 1}.{k + 1}
                            </td>
                            <td className="pr-2">{sp.description}</td>
                            <td className="pr-2 text-w60 whitespace-nowrap">{sp.shotType}</td>
                            <td className="pr-2 text-w60 whitespace-nowrap">{sp.movement}</td>
                            <td className="text-right">{sp.duration}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                ))}
              </div>
            </>
          )}
          {ep.scenes.length === 0 && <p className="text-12 text-w50">Run a breakdown to get scenes, emotional beats, dialogue tracks and a shot list. Without Claude connected, the local engine does it with rules.</p>}
        </section>

        {/* cast editor */}
        <aside className="rounded-16 bg-[#262d32] border border-w5 p-3">
          <h2 className="text-14 font-semibold mb-3">Cast profile</h2>
          {cSel ? <CastEditor key={cSel.id} c={cSel} /> : <p className="text-12 text-w50">Add a character to start.</p>}
          <div className="mt-4 rounded-12 bg-w5 p-2.5 text-12">
            <p className="font-semibold">Model for this episode</p>
            <div className="mt-1 h-8 flex items-center">
              <Select label="Episode model" value={st.modelId} onChange={(v) => st.set({ modelId: v })} options={st.models.filter((m) => m.kind === "video" && m.enabled).map((m) => ({ id: m.id, label: m.name }))} />
            </div>
          </div>
        </aside>
      </div>
      <div className="sticky bottom-0">
        <Timeline />
      </div>
      <Preflight lines={pending?.lines || null} onCancel={() => setPending(null)} onApprove={approve} />
    </div>
  );
}
