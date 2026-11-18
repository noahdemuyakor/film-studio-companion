"use client";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { uid } from "@/lib/util";
import Scene from "../Scene";
import { Bars, Book, ChevronR, Folder, Image as ImageIcon, Minus, Music, Plus, Sliders, Wave } from "../Icons";
import { Select } from "../ui";

type Take = { id: string; text: string; voice: string; castId?: string; rate: number; pitch: number; at: number };

/** Text to speech for dialogue tracks. Uses the browser's speech engine as the local voice model. */
export default function AudioStudio() {
  const st = useStudio();
  const [tab, setTab] = useState<"tts" | "change" | "translate">("tts");
  const [script, setScript] = useState("");
  const [details, setDetails] = useState("");
  const [batch, setBatch] = useState(1);
  const [castId, setCastId] = useState("");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voice, setVoice] = useState("");
  const [takes, setTakes] = useState<Take[]>([]);
  const [panel, setPanel] = useState<"history" | "how">("how");
  const file = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<string[]>([]);

  useEffect(() => {
    if (typeof speechSynthesis === "undefined") return;
    const load = () => setVoices(speechSynthesis.getVoices());
    load();
    speechSynthesis.onvoiceschanged = load;
  }, []);

  const [advanced, setAdvanced] = useState(false);
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState<number | null>(null);
  const [onlyThisVoice, setOnlyThisVoice] = useState(false);
  const member = st.cast.find((c) => c.id === castId);
  const shownTakes = onlyThisVoice ? takes.filter((t) => t.castId === castId && t.voice === voice) : takes;
  const speak = (t: Take) => {
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(t.text);
    const v = voices.find((x) => x.name === t.voice);
    if (v) u.voice = v;
    u.rate = t.rate;
    u.pitch = t.pitch;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  };
  const generate = () => {
    if (!script.trim()) return;
    const made: Take[] = Array.from({ length: batch }, (_, k) => ({ id: uid("take"), text: script, voice, castId, rate: Math.max(0.5, rate - k * 0.05), pitch: pitch ?? member?.voice.pitch ?? 1, at: Date.now() }));
    setTakes((v) => [...made, ...v]);
    setPanel("history");
    speak(made[0]);
  };
  const toTimeline = (t: Take) => {
    const words = t.text.split(/\s+/).length;
    st.update("clips", (clips) => {
      const end = clips.filter((c) => c.track === "dialogue").reduce((a, c) => Math.max(a, c.start + c.duration), 0);
      return [...clips, { id: uid("clip"), track: "dialogue", start: end, duration: Math.max(1.5, words / 2.6), label: `${member ? member.name.toUpperCase() + ": " : ""}${t.text.slice(0, 40)}`, seed: words, transition: "cut", subtitle: t.text }];
    });
  };

  const left = (
    <div className="rounded-16 bg-[#262d32] border border-w5 flex flex-col overflow-hidden h-full">
      <div className="flex gap-5 px-5 border-b border-w5">
        {(
          [
            ["tts", "Text to Speech"],
            ["change", "Voice Change"],
            ["translate", "Translate"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`h-[46px] text-14 font-medium border-b-2 ${tab === k ? "border-white" : "border-transparent text-w50"}`}>
            {l}
          </button>
        ))}
      </div>
      <div className="thin-scroll flex-1 overflow-y-auto p-3 flex flex-col gap-3">
        <button onClick={() => file.current?.click()} className="relative h-[170px] shrink-0 rounded-12 border border-dashed border-w10 bg-w5 flex flex-col items-center justify-center">
          <span className="absolute right-2 top-2 text-[11px] text-w40 bg-w10 rounded-6 px-1.5 py-0.5">Optional</span>
          <span className="flex -space-x-1.5">
            {[Wave, Music, ImageIcon].map((I, k) => (
              <span key={k} className="w-10 h-10 rounded-full bg-[#36404a] border border-w10 grid place-items-center">
                <I size={14} />
              </span>
            ))}
          </span>
          <span className="mt-3 text-16 font-semibold">{uploads.length ? `${uploads.length} file(s) added` : "Upload media"}</span>
          <span className="mt-1 text-14 text-mute">Up to 3 Voices/Audios or Image</span>
        </button>
        <input ref={file} type="file" accept="audio/*,image/*" multiple hidden onChange={(e) => setUploads(Array.from(e.target.files || []).slice(0, 3).map((f) => f.name))} />
        <section className="shrink-0 rounded-12 bg-w5 p-3 h-[160px] flex flex-col gap-1">
          <p className="text-14 text-w50 font-medium">Script</p>
          <textarea aria-label="Script" value={script} onChange={(e) => setScript(e.target.value)} placeholder={tab === "translate" ? "Paste dialogue to translate and re-voice" : "Write exactly what the voice will read out loud. Type @ to reference attachments"} className="flex-1 bg-transparent resize-none outline-none text-12 leading-[18px] placeholder:text-w40" />
        </section>
        <div className="shrink-0 rounded-12 bg-w5 px-3 py-2.5 flex items-center justify-between">
          <span>
            <span className="block text-12 text-w50">Model</span>
            <span className="text-14 font-semibold flex items-center gap-1.5">
              Studio Voice 1.0 <Bars size={12} className="text-lime" />
            </span>
          </span>
          <ChevronR size={16} className="text-w50" />
        </div>
        <div className="shrink-0 rounded-12 bg-w5 px-3 py-2.5 grid grid-cols-2 gap-2">
          <div>
            <span className="block text-12 text-w50">Cast voice</span>
            <Select label="Cast voice" value={castId} onChange={setCastId} options={[{ id: "", label: "Narrator" }, ...st.cast.map((c) => ({ id: c.id, label: `${c.name} — ${c.voice.name}` }))]} className="text-12" />
          </div>
          <div>
            <span className="block text-12 text-w50">Device voice</span>
            <Select label="Device voice" value={voice} onChange={setVoice} options={[{ id: "", label: "Default" }, ...voices.slice(0, 40).map((v) => ({ id: v.name, label: v.name }))]} className="text-12" />
          </div>
        </div>
        <div className="shrink-0 rounded-12 bg-w5 px-3 h-12 flex items-center justify-between text-14 font-semibold">
          Batch size
          <span className="flex items-center gap-3">
            <button aria-label="Fewer" onClick={() => setBatch(Math.max(1, batch - 1))} className="text-w50">
              <Minus size={12} />
            </button>
            {batch}/4
            <button aria-label="More" onClick={() => setBatch(Math.min(4, batch + 1))}>
              <Plus size={12} />
            </button>
          </span>
        </div>
        <section className="shrink-0 rounded-12 bg-w5 p-3 h-[120px] flex flex-col gap-1 relative">
          <span className="absolute right-2 top-2 text-[11px] text-w40 bg-w10 rounded-6 px-1.5 py-0.5">Optional</span>
          <p className="text-14 text-w50 font-medium">Voice details</p>
          <textarea aria-label="Voice details" maxLength={500} value={details || member?.voice.style || ""} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. Young female voice with a british accent, soft and loud. Excited, giggling" className="flex-1 bg-transparent resize-none outline-none text-12 leading-[18px] placeholder:text-w40" />
          <span className="self-end text-[11px] text-w50">{details.length}/500</span>
        </section>
        <button onClick={() => setAdvanced(!advanced)} aria-expanded={advanced} className="shrink-0 h-10 px-1 text-14 font-semibold flex items-center gap-2">
          <Sliders size={14} /> Advanced settings <ChevronR size={14} className={`ml-auto transition-transform ${advanced ? "rotate-90" : ""}`} />
        </button>
        {advanced && (
          <div className="shrink-0 rounded-12 bg-w5 p-3 flex flex-col gap-3 text-12">
            <label className="flex items-center gap-3">
              <span className="w-12 text-w50">Speed</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="flex-1 accent-[#8db600]" />
              <span className="w-10 text-right tabular-nums">{rate.toFixed(2)}x</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-12 text-w50">Pitch</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={pitch ?? member?.voice.pitch ?? 1} onChange={(e) => setPitch(Number(e.target.value))} className="flex-1 accent-[#8db600]" />
              <span className="w-10 text-right tabular-nums">{(pitch ?? member?.voice.pitch ?? 1).toFixed(2)}</span>
            </label>
            <button onClick={() => (setRate(1), setPitch(null))} className="self-end text-w50 hover:text-white">Reset</button>
          </div>
        )}
      </div>
      <div className="p-3 pt-0">
        <button onClick={generate} className="w-full h-[52px] rounded-12 text-18 font-medium text-dark-2" style={{ background: "linear-gradient(180deg,#8db600,#668400)" }}>
          Generate
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6 px-4 pt-1 h-[calc(100vh-112px)] md:h-[calc(100vh-84px)] lg:h-[calc(100vh-44px)]">
      <aside className="md:w-[352px] md:shrink-0 h-full pb-4">{left}</aside>
      <div className="hidden md:flex flex-1 min-w-0 flex-col gap-2 pb-4">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setPanel("history")} className={`h-9 px-3 rounded-8 text-12 font-semibold flex items-center gap-1.5 border border-w10 ${panel === "history" ? "bg-w10" : "text-w60"}`}>
            <Folder size={14} /> History
          </button>
          <button onClick={() => setPanel("how")} className={`h-9 px-3 rounded-8 text-12 font-semibold flex items-center gap-1.5 ${panel === "how" ? "bg-w10" : "text-w60"}`}>
            <Book size={14} /> How it works
          </button>
          <button onClick={() => (setOnlyThisVoice(!onlyThisVoice), setPanel("history"))} title="Show only takes in the voice picked on the left" className={`ml-auto h-9 px-3 rounded-8 border border-w10 text-12 font-semibold flex items-center gap-1.5 ${onlyThisVoice ? "bg-w10 text-white" : "text-w60"}`}>
            <Sliders size={14} /> {onlyThisVoice ? "This voice only" : "All voices"}
          </button>
        </div>
        <div className="thin-scroll flex-1 overflow-y-auto rounded-16 border border-w10 bg-[#232a2f]">
          {panel === "how" || shownTakes.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <h2 className="font-display font-bold uppercase text-28 leading-8">Turn text into speech</h2>
              <p className="mt-2 text-18 text-w50 max-w-[300px] mx-auto leading-7">Lifelike speech from any script — ready for your timeline</p>
              <div className="mt-8 max-w-[326px] mx-auto rounded-24 bg-[#262d32] border border-w5 p-6 text-left">
                <h3 className="text-24 font-medium">Pick or clone a voice</h3>
                <p className="mt-2 text-16 text-w50">Choose a preset, give each cast member a voice, or pick a model</p>
                <Scene name="dark" className="mt-6 h-[160px] rounded-16">
                  <span className="absolute left-3 top-3 rounded-full bg-black/60 border border-w10 px-3 py-1 text-14">{st.cast[1]?.name || "Jonah"}</span>
                  <span className="absolute left-6 right-3 bottom-4 h-16 rounded-full bg-white/10 border border-w10 flex items-center gap-3 px-2">
                    <span className="w-12 h-12 rounded-full bg-[#ff5a4d] grid place-items-center">
                      <Bars size={20} />
                    </span>
                    <span className="text-24">{st.cast[0]?.name || "Maya"}</span>
                  </span>
                </Scene>
              </div>
            </div>
          ) : (
            <ul className="p-3 flex flex-col gap-2">
              {shownTakes.map((t) => (
                <li key={t.id} className="rounded-12 bg-w5 p-3 flex items-center gap-3">
                  <button onClick={() => speak(t)} className="w-10 h-10 rounded-full bg-lime text-dark grid place-items-center shrink-0" aria-label="Play">
                    ▶
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-14 truncate">{t.text}</p>
                    <p className="text-12 text-w50">
                      {st.cast.find((c) => c.id === t.castId)?.name || "Narrator"} · {t.voice || "default voice"} · rate {t.rate.toFixed(2)}
                    </p>
                  </div>
                  <button onClick={() => toTimeline(t)} className="h-8 px-3 rounded-8 bg-w10 text-12 font-semibold">
                    To timeline
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
