"use client";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Scene from "../Scene";
import { Arrow, Bars, ChevronR, Clock, Copy, Expand, Image as ImageIcon, Plus, Rerun, Speaker, Spark, Trash } from "../Icons";
import { useStudio } from "@/lib/store";

const H2 = "font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17]";

export function Hero() {
  const router = useRouter();
  const set = useStudio((s) => s.set);
  const settings = useStudio((s) => s.settings);
  const [text, setText] = useState("");
  const [dur, setDur] = useState(8);
  const [audio, setAudio] = useState(true);
  const go = () => {
    set({ prompt: text, settings: { ...settings, duration: dur, audio } });
    router.push("/ai/video/");
  };
  return (
    <section className="relative md:mt-2 overflow-hidden" aria-label="AI video generator">
      <div className="relative h-[532px] md:h-[788px]">
        {/* side peeks of the carousel */}
        <Scene name="cafe" className="hidden md:block absolute top-0 h-full rounded-24" style={{ left: "calc(5vw - 180vw - 48px)", width: "90vw" }} />
        <Scene name="sky" className="hidden md:block absolute top-0 h-full rounded-24" style={{ left: "calc(5vw - 90vw - 24px)", width: "90vw" }} />
        <Scene name="sea" className="absolute top-0 h-full w-full left-[calc(100%+16px)] md:w-[90vw] md:left-[calc(95vw+24px)] md:rounded-24" />
        <Scene name="dusk" className="hidden md:block absolute top-0 h-full rounded-24" style={{ left: "calc(5vw + 180vw + 48px)", width: "90vw" }} />
        <Scene name="field" className="hidden md:block absolute top-0 h-full rounded-24" style={{ left: "calc(5vw + 270vw + 72px)", width: "90vw" }} />
        <Scene name="pier" className="absolute top-0 h-full w-full md:w-[90vw] md:left-[5vw] md:rounded-24">
          <div className="absolute inset-0 bg-[#00000033]" />
          <div className="relative z-10 h-full flex flex-col items-center justify-end md:justify-start pb-[26px] md:pb-0 md:pt-20 px-6 md:px-0 text-center">
            <div className="w-full max-w-hero flex flex-col items-center">
            <h1 className="font-display font-bold uppercase text-28 md:text-48 lg:text-64 leading-[1.28] md:leading-[1.17] lg:leading-[1.125] md:w-[calc(100%+64px)] md:-mx-8 drop-shadow">
              AI video generator.
              <br />
              Studio-grade results.
            </h1>
            <p className="mt-2 md:mt-4 max-w-[672px] text-12 md:text-18 font-normal leading-4 md:leading-[26px] drop-shadow">
              From prompt to cinematic video in seconds. Every top model, one workspace, with Claude directing the details.
            </p>
            <NextLink href="/ai/video/" className="btn-white mt-[22px] md:mt-8 h-[46px] md:h-[52px] px-6 rounded-12 text-14 md:text-16 font-semibold flex items-center">
              Create Video Now
            </NextLink>
            </div>
          </div>
          {/* prompt bar */}
          <div className="hidden md:flex absolute z-10 left-1/2 -translate-x-1/2 top-[580px] w-[672px] max-w-[calc(100%-16px)] h-[116px] rounded-16 border border-w10 bg-[#00000033] backdrop-blur-xl p-2 gap-2">
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="flex items-start gap-3 pl-1 pt-2">
                <button aria-label="Upload image" className="w-8 h-8 shrink-0 rounded-8 bg-w5 grid place-items-center">
                  <Plus size={16} />
                </button>
                <textarea
                  aria-label="Prompt"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), go())}
                  placeholder="Describe any visual idea. We will generate a video."
                  className="flex-1 bg-transparent resize-none outline-none text-16 placeholder:text-w50 h-8 leading-6 pt-1"
                />
              </div>
              <div className="mt-auto flex items-center gap-[5px] pl-1 pb-1">
                <NextLink href="/models/" className="h-8 px-2.5 rounded-8 bg-w5 flex items-center gap-1.5 text-12 font-semibold">
                  <Bars size={14} /> Seedance 2.5
                </NextLink>
                <button onClick={() => setDur(dur >= 15 ? 5 : dur + 1)} className="h-8 px-2.5 rounded-8 bg-w5 flex items-center gap-1.5 text-12 font-semibold">
                  <Clock size={14} className="text-w50" /> {dur}s
                </button>
                <button className="h-8 px-2.5 rounded-8 bg-w5 flex items-center gap-1.5 text-12 font-semibold">
                  <Expand size={14} className="text-w50" /> Auto
                </button>
                <button onClick={() => setAudio(!audio)} className="h-8 px-2.5 rounded-8 bg-w5 flex items-center gap-1.5 text-12 font-semibold">
                  <Speaker size={14} className="text-w50" /> {audio ? "On" : "Off"}
                </button>
              </div>
            </div>
            <button onClick={go} className="btn-lime w-[120px] h-[80px] mt-3 rounded-12 text-12 font-bold">
              GENERATE
            </button>
          </div>
        </Scene>
      </div>
    </section>
  );
}

const STEPS = [
  { t: "1. Choose How You Want to Start", b: "Start from a text prompt, an image you want to bring to life, or an existing clip to use as a motion or editing reference. The inputs on offer follow the model you pick." },
  { t: "2. Select an AI Video Model", b: "Pick from the models in your registry, from fast draft engines to high-end cinema models. Each one handles motion, realism, audio, speed and control its own way, so you can match the model to the shot." },
  { t: "3. Enter a Prompt and Add References", b: "Describe the shot you want. Name the subject and action, the setting and light, the camera move and the mood. Claude rewrites it for the model you chose." },
  {
    t: "4. Adjust the Available Settings",
    b: "Tune the settings your model supports. These can include:",
    list: ["Video duration", "Aspect ratio", "Resolution", "Reference frames", "Camera or motion controls", "Audio options"],
    after: "Controls change from model to model.",
  },
  { t: "5. Generate Your Video", b: "Check the credit estimate on the Generate button and start. Finished shots land in History, where you can review them, chain the next shot or send them to the timeline." },
];

export function HowTo() {
  return (
    <section className="min-h-[1734px] md:min-h-[1638px] lg:min-h-[1084px] px-4 py-16 md:px-8 md:py-20 lg:px-16 lg:pt-20 lg:pb-[120px]">
      <div className="max-w-steps mx-auto">
        <header className="max-w-intro mx-auto text-center flex flex-col gap-2">
          <h2 className={H2}>How to make AI videos with Film Studio</h2>
          <p className="text-18 text-mute leading-[26px]">
            Turn a prompt, an image or a clip you already have into an AI video in a few steps. Every leading model sits in one place, so you can pick
            the right one and the right controls for each idea.
          </p>
        </header>
        <div className="mt-10 lg:mt-20 grid grid-cols-1 lg:grid-cols-3 lg:grid-rows-[242px_314px] gap-4 max-w-[426px] lg:max-w-none mx-auto">
          {STEPS.map((s) => (
            <article key={s.t} className="rounded-16 bg-panel border border-w5 p-6 lg:min-h-[242px]">
              <h3 className="text-20 font-semibold leading-6 tracking-[-0.025em]">{s.t}</h3>
              <p className="text-18 font-medium text-mute leading-6">{s.b}</p>
              {s.list && (
                <ul className="list-disc pl-5 text-18 font-medium text-mute leading-6">
                  {s.list.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
              {s.after && <p className="text-18 font-medium text-mute leading-6">{s.after}</p>}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function useScale(design: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setS(el.clientWidth / design));
    ro.observe(el);
    setS(el.clientWidth / design);
    return () => ro.disconnect();
  }, [design]);
  return [ref, s] as const;
}

function MockCard({ text, refs }: { text: string; refs: string[] }) {
  return (
    <div className="flex-1 rounded-16 bg-[#232a2f] border border-w5 p-3 flex flex-col">
      <span className="text-10 font-semibold flex items-center gap-1.5">
        <Bars size={12} /> Kling 3.0
      </span>
      <p className="mt-4 text-13 text-w60 leading-[18px] text-[13px]">{text}</p>
      <div className="flex gap-2 mt-3">
        {refs.map((r) => (
          <Scene key={r} name={r} className="w-8 h-8 rounded-6" />
        ))}
      </div>
      <div className="mt-auto flex items-center text-10 font-semibold">
        <Rerun size={12} className="mr-1" /> Rerun
        <Copy size={12} className="ml-auto mr-3" />
        <Trash size={12} />
      </div>
    </div>
  );
}

export function Control() {
  const [ref, s] = useScale(1280);
  return (
    <section className="min-h-[517px] md:min-h-[830px] lg:min-h-0 py-10 md:py-20">
      <header className="max-w-wide mx-auto flex flex-col gap-4 px-4 text-center">
        <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17]">AI video creation with you in control</h2>
        <p className="text-14 text-mute max-w-[768px] mx-auto leading-5">
          Go further than the first prompt. Steer the camera, shape the action and fine-tune the look with tools built for real creative control.
        </p>
      </header>
      <div className="px-4 mt-10">
        <div ref={ref} className="max-w-col mx-auto relative" style={{ aspectRatio: "1280 / 820" }}>
          <div className="absolute left-0 top-0 w-[1280px] h-[820px] origin-top-left rounded-24 border border-w5 bg-[#20262a] p-[18px] flex gap-4" style={{ transform: `scale(${s})` }}>
            <div className="w-[284px] flex flex-col gap-3.5">
              <Scene name="golf" className="h-[131px] rounded-12">
                <span className="absolute right-2 top-2 text-12 font-medium bg-black/40 rounded-full px-2 py-0.5">Change</span>
                <span className="absolute left-3 bottom-6 font-display font-bold text-20 text-lime">GENERAL</span>
                <span className="absolute left-3 bottom-2 text-12 text-w60">Kling 3.0</span>
              </Scene>
              <div className="grid grid-cols-2 gap-1 h-[142px]">
                {["Start Frame", "End Frame"].map((l) => (
                  <div key={l} className="rounded-12 bg-[#262d32] border border-dashed border-w10 flex flex-col items-center justify-center gap-3 text-14 text-w60">
                    <span className="w-8 h-8 rounded-full bg-w5 grid place-items-center">
                      <ImageIcon size={14} />
                    </span>
                    {l}
                  </div>
                ))}
              </div>
              <div className="rounded-12 bg-[#262d32] h-[107px] p-3">
                <p className="text-14 text-w60">Prompt</p>
                <p className="text-13 text-[13px] text-w40 mt-1">Describe the scene you imagine, with details.</p>
              </div>
              <div className="rounded-12 bg-[#262d32] h-[50px] px-3 flex items-center justify-between">
                <div>
                  <p className="text-12 text-w50">Model</p>
                  <p className="text-14">Kling 3.0</p>
                </div>
                <ChevronR size={16} />
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {["12s", "1080p", "4:3"].map((c) => (
                  <span key={c} className="h-[34px] rounded-10 bg-[#262d32] flex items-center gap-1.5 px-3 text-14">
                    {c}
                  </span>
                ))}
              </div>
              <div className="btn-lime h-[42px] rounded-10 flex items-center justify-center gap-2 text-14 font-semibold">
                Generate <Spark size={14} /> 5
              </div>
            </div>
            <div className="w-[689px] flex flex-col gap-4">
              <Scene name="ring" className="flex-1 rounded-12" />
              <Scene name="racecar" className="flex-1 rounded-12" />
            </div>
            <div className="flex-1 flex flex-col gap-4">
              <MockCard refs={["face", "ring"]} text="Wide shot from the back of a packed concert crowd using the venue reference. Hands raised as white beams sweep through haze. Strong backlight, deep shadows, euphoric mood, cinematic grade." />
              <MockCard refs={["racecar"]} text="Long-exposure night shot of a highway curve, red and white light trails streaking through the frame, slow push in, high-end commercial grade." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  { t: "Guide the First Frame to the Final Shot", b: "Set the opening and closing images to steer how a scene plays out. Build deliberate transitions and give every clip a clear destination.", scene: "dark", kind: "frames" },
  { t: "Transform Footage Without Reshooting", b: "Swap a character, product or setting in footage you already have while the original motion and timing stay intact. Make new takes without a new shoot.", scene: "ice", kind: "split" },
  { t: "Turn Real Movement into Character Performance", b: "Pair a character image with a reference video to carry over movement, timing and expression. Bring choreography, stunts or your own performance into a shot.", scene: "creator", kind: "pip" },
];

export function Features() {
  return (
    <section className="max-w-col mx-auto px-4 pt-10 pb-[100px] md:min-h-[549px] lg:min-h-[526px]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-[60px] md:gap-5">
        {FEATURES.map((f) => (
          <NextLink key={f.t} href="/ai/video/" className="block text-soft group">
            <div className="rounded-16 border border-w5 bg-[#20262a] aspect-[403/217] relative overflow-hidden">
              {f.kind === "frames" && (
                <div className="absolute inset-0 flex items-center justify-center gap-0">
                  <Scene name="portrait" className="w-[18%] h-[38%] rounded-6 opacity-60" />
                  <Scene name="ice" className="w-[50%] h-[58%] rounded-6 z-10 shadow-2xl" />
                  <Scene name="field" className="w-[18%] h-[38%] rounded-6 opacity-60" />
                </div>
              )}
              {f.kind === "split" && (
                <div className="absolute inset-0 grid grid-cols-2">
                  <Scene name="product" />
                  <Scene name="ice" />
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-4 text-12 bg-black/60 rounded-full px-3 py-1">Turn it to Ad</span>
                </div>
              )}
              {f.kind === "pip" && (
                <div className="absolute inset-0">
                  <Scene name="creator" className="absolute left-[8%] top-[10%] w-[66%] h-[70%] rounded-6" />
                  <Scene name="cafe" className="absolute right-[8%] bottom-[10%] w-[38%] h-[40%] rounded-6 border border-w10" />
                </div>
              )}
            </div>
            <h3 className="mt-5 text-24 font-medium leading-[30px]">{f.t}</h3>
            <p className="mt-2 text-14 text-mute leading-5">{f.b}</p>
          </NextLink>
        ))}
      </div>
    </section>
  );
}

export function CinemaBand() {
  return (
    <section className="relative min-h-[532px] md:min-h-[1136px] lg:min-h-[1150px] flex flex-col justify-end">
      <Scene name="cafe" className="absolute inset-x-0 top-0 h-full md:h-[837px]" />
      <div className="absolute inset-x-0 bottom-0 h-[70%] md:h-[60%] bg-gradient-to-b from-transparent via-ink/70 to-ink" />
      <div className="relative max-w-wide w-full mx-auto px-6 md:px-4 lg:px-[88px] pb-8 md:pb-10">
        <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17]">Cinema Studio</h2>
        <p className="mt-4 max-w-[1024px] text-12 md:text-18 leading-4 md:leading-[26px]">
          Cinema Studio turns AI video generation into a filmmaking workspace. Develop connected scenes with reusable characters, locations and props,
          lock frames between shots, and keep creative decisions consistent across the whole project.
        </p>
        <NextLink href="/ai/video/" className="btn-white mt-6 md:mt-8 inline-flex items-center gap-3 h-10 md:h-[52px] px-6 md:px-6 rounded-12 text-14 md:text-16 font-semibold">
          <Arrow size={22} /> Try Cinema Studio
        </NextLink>
      </div>
    </section>
  );
}
