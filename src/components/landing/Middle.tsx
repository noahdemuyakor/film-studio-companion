"use client";
import NextLink from "next/link";
import { useRef, useState } from "react";
import Scene from "../Scene";
import { Arrow, Bars, ChevronL, ChevronR, Mute, Plus, Speaker } from "../Icons";
import { useStudio } from "@/lib/store";

function Arrows({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex justify-center gap-2.5">
      <button aria-label="Previous" onClick={onPrev} className="w-12 h-12 rounded-full bg-w5 grid place-items-center text-white/15 hover:text-white">
        <ChevronL size={16} />
      </button>
      <button aria-label="Next" onClick={onNext} className="w-12 h-12 rounded-full bg-w5 grid place-items-center text-white/30 hover:text-white">
        <ChevronR size={16} />
      </button>
    </div>
  );
}

function OpticalMock() {
  const tiles = [
    { k: "CAMERA", v: "Classic 16mm Film", sub: "FILM" },
    { k: "LENS", v: "Warm Cinema Prime", sub: "SPHERICAL" },
    { k: "FOCAL LENGTH", v: "mm", big: "35" },
    { k: "APERTURE", v: "f/1.4", ring: true },
  ];
  return (
    <div className="absolute inset-[7%] rounded-16 border border-w10 bg-[#2a3136]/80 p-[1.5%] flex flex-col">
      <div className="flex gap-3 text-[8px] md:text-[9px] font-medium px-1 py-1">
        <span className="bg-white text-dark rounded-full px-2">All</span>
        <span>Recommended</span>
        <span>Saved</span>
      </div>
      <div className="flex-1 grid grid-cols-4 gap-[3%] items-center px-[2%] border-y border-w10 my-[4%]">
        {tiles.map((t) => (
          <div key={t.k} className="flex flex-col items-center gap-1 text-center">
            <div className="w-full aspect-square rounded-8 bg-white/5 flex flex-col items-center justify-center text-[6px] md:text-[7px] text-w50 gap-1">
              {t.k}
              {t.big ? (
                <span className="text-white text-12 font-semibold">{t.big}</span>
              ) : t.ring ? (
                <span className="w-6 h-6 rounded-full border-4 border-w30" />
              ) : (
                <span className="w-7 h-4 rounded-[3px] bg-white/40" />
              )}
              {t.sub}
            </div>
            <span className="text-[7px] md:text-[8px] text-white">{t.v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const S2S = [
  { lead: "BESPOKE OPTICAL STACK.", body: "Define your cinematic look with camera bodies from modern digital to 35mm film. Pair them with vintage or anamorphic glass to give each scene its own character.", ar: 499 / 333, kind: "optical" },
  { lead: "MULTI-AXIS MOTION CONTROL.", body: "Go beyond a single camera move. Stack pans, zooms, orbits and cranes for more dynamic, cinematic shots.", ar: 1, kind: "motion" },
  { lead: "DIRECTOR'S PANEL.", body: "Set genre, camera, lens, lighting and palette before you generate. Shape the look and pacing of the scene.", ar: 387 / 333, kind: "panel" },
  { lead: "SCRIPT TO SCENE.", body: "Describe your vision in words and let the Showrunner break it into scenes, beats and shots on the canvas.", ar: 1.2, kind: "script" },
  { lead: "VISUAL REFERENCE.", body: "Upload an image to set the direction. Lock characters, props and places in the Reference Vault.", ar: 1, kind: "ref" },
];

export function ScriptToScreen() {
  const track = useRef<HTMLDivElement>(null);
  const [move, setMove] = useState("Zoom Out");
  const scroll = (d: number) => track.current?.scrollBy({ left: d * 420, behavior: "smooth" });
  return (
    <section className="overflow-hidden">
      <div className="max-w-col mx-auto px-4 pt-10 md:pt-[100px]">
        <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17]">From script to screen</h2>
        <div ref={track} className="no-scrollbar mt-6 md:mt-10 flex gap-4 overflow-x-auto -mr-[100vw] pr-[100vw]">
          {S2S.map((c) => (
            <div key={c.lead} className="shrink-0 w-fit">
              <div className="h-[225px] md:h-[300px] lg:h-[333px] rounded-24 relative overflow-hidden border border-w5" style={{ aspectRatio: String(c.ar) }}>
                {c.kind === "optical" && (
                  <div className="absolute inset-0 bg-gradient-to-br from-[#36404a] to-[#121416]">
                    <OpticalMock />
                  </div>
                )}
                {c.kind === "motion" && (
                  <Scene name="fire" className="absolute inset-0">
                    <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1 text-12">
                      {["Handheld", "Zoom Out", "Orbit Around"].map((m) => (
                        <button key={m} onClick={() => setMove(m)} className={`px-3 h-8 rounded-full ${move === m ? "bg-black/30 border border-white/30 text-white" : "text-white/50"}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </Scene>
                )}
                {c.kind === "panel" && (
                  <div className="absolute inset-0 bg-[#20262a] p-5 flex flex-col gap-2">
                    {["Genre · Thriller", "Camera · 35mm Film", "Lens · Anamorphic", "Lighting · Neon Night", "Palette · Teal / Amber"].map((r) => (
                      <span key={r} className="rounded-10 bg-w5 px-3 py-2 text-12 text-w60">
                        {r}
                      </span>
                    ))}
                  </div>
                )}
                {c.kind === "script" && <Scene name="dusk" className="absolute inset-0" />}
                {c.kind === "ref" && <Scene name="portrait" className="absolute inset-0" />}
              </div>
              <p className="mt-4 w-0 min-w-full text-14 font-medium text-mute leading-5">
                <span className="text-white">{c.lead}</span> {c.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 pb-[104px] md:pb-[81px] lg:pb-[144px]">
          <div className="hidden md:block">
            <Arrows onPrev={() => scroll(-1)} onNext={() => scroll(1)} />
          </div>
        </div>
      </div>
    </section>
  );
}

const LOOKS = [
  { scene: "portrait", camera: "Modular 8K Digital", lens: "Classic Anamorphic", focal: "35mm" },
  { scene: "ice", camera: "35mm Film", lens: "Vintage Prime", focal: "50mm" },
  { scene: "sky", camera: "Modern Digital", lens: "Clean Spherical", focal: "24mm" },
  { scene: "product", camera: "Classic 16mm Film", lens: "Warm Cinema Prime", focal: "85mm" },
  { scene: "city", camera: "DV Camcorder", lens: "Fisheye", focal: "14mm" },
];

export function Showcase() {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(true);
  const l = LOOKS[i];
  return (
    <section className="py-10 md:py-20 lg:py-[140px]">
      <div className="max-w-col mx-auto px-4">
      <Scene name={l.scene} className="rounded-24 aspect-[1248/698] transition-all">
        <div className="absolute left-8 md:left-12 bottom-8 md:bottom-9 flex gap-8 md:gap-8">
          {[
            ["CAMERA", l.camera],
            ["LENS", l.lens],
            ["FOCAL LENGTH", l.focal],
          ].map(([k, v]) => (
            <div key={k} className="max-w-[90px] md:max-w-none">
              <p className="text-10 md:text-12 font-medium text-white/90">{k}</p>
              <p className="text-12 md:text-14 font-semibold">{v}</p>
            </div>
          ))}
        </div>
      </Scene>
      <div className="mt-[42px] flex justify-center gap-3">
        <div className="flex items-center gap-2 h-14 px-2 rounded-full bg-ink-2">
          {LOOKS.map((x, k) => (
            <button
              key={x.scene}
              aria-label={`Look ${k + 1}`}
              onClick={() => setI(k)}
              className={`h-8 rounded-full overflow-hidden transition-all ${k === i ? "w-[72px] h-10 ring-2 ring-white ring-offset-2 ring-offset-ink-2" : "w-8"}`}
            >
              <Scene name={x.scene} className="w-full h-full" />
            </button>
          ))}
        </div>
        <button aria-label={muted ? "Unmute" : "Mute"} onClick={() => setMuted(!muted)} className="w-14 h-14 rounded-full bg-ink-2 grid place-items-center">
          {muted ? <Mute size={18} /> : <Speaker size={18} />}
        </button>
      </div>
      </div>
    </section>
  );
}

const CLOUD = [
  { name: "Kling 3.0", scene: "face", blurb: "Photoreal motion with start and end frame control", lg: [12.8, 112], md: [3.1, 74] },
  { name: "Seedance 2.5", scene: "dusk", blurb: "Native audio and multi-shot storytelling in one pass", lg: [43.5, 67], md: [40.4, 34] },
  { name: "Wan 2.7", scene: "ice", blurb: "Fast, open drafts for previs and blocking", lg: [74.2, 85], md: [77.7, 34] },
  { name: "Kling 4.0", scene: "sky", blurb: "Next-gen motion complexity with synced sound", lg: [8.3, 382], md: [2, 314] },
  { name: "MiniMax H3", scene: "sea", blurb: "Expressive faces and fluid character acting", lg: [76.9, 472], md: [78.8, 410] },
  { name: "Veo 3.1", scene: "field", blurb: "Cinematic prose prompts with dialogue and SFX", lg: [19.1, 772], md: [12.2, 641] },
  { name: "Omni Flash", scene: "hand", blurb: "Cheap, quick drafts before the final render", lg: [54.5, 744], md: [55.2, 664] },
];

function CloudCard({ c }: { c: (typeof CLOUD)[number] }) {
  return (
    <NextLink href="/models/" className="group block w-[160px] h-[106px] lg:w-[200px] lg:h-[124px] rounded-16 overflow-hidden shadow-[0_20px_40px_rgba(0,0,0,.5)]">
      <Scene name={c.scene} className="w-full h-full">
        <span className="absolute inset-0 flex items-center justify-center gap-1.5 text-16 lg:text-20 font-semibold transition-opacity group-hover:opacity-0">
          <Bars size={18} /> {c.name}
        </span>
        <span className="absolute inset-0 bg-black/70 p-4 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-12 font-medium leading-[15px]">{c.blurb}</span>
          <span className="self-start h-[30px] px-4 rounded-8 bg-white text-black text-12 font-semibold flex items-center">Generate</span>
        </span>
      </Scene>
    </NextLink>
  );
}

export function ModelsCloud() {
  return (
    <section className="relative py-10 min-h-[552px] md:min-h-0">
      <div className="relative max-w-col mx-auto md:h-[800px] lg:h-[900px]">
        <div className="hidden md:block">
          {CLOUD.map((c) => (
            <div key={c.name} className="absolute md:left-[var(--ml)] md:top-[var(--mt)] lg:left-[var(--ll)] lg:top-[var(--lt)]" style={{ ["--ml" as string]: `${c.md[0]}%`, ["--mt" as string]: `${c.md[1]}px`, ["--ll" as string]: `${c.lg[0]}%`, ["--lt" as string]: `${c.lg[1]}px` }}>
              <CloudCard c={c} />
            </div>
          ))}
        </div>
        <div className="md:absolute md:inset-0 flex flex-col items-center justify-center text-center px-4 pointer-events-none">
          <span className="rounded-6 bg-w5 px-2 py-1 text-12 font-semibold uppercase max-w-[326px] md:max-w-none">Get new models the day they&apos;re released</span>
          <h2 className="mt-4 font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17] max-w-[640px]">Explore leading AI video models in one studio</h2>
          <p className="mt-4 text-12 md:text-16 text-w60 leading-4 md:leading-6 max-w-[640px]">
            Create with Kling, Veo, Seedance, Wan and any model you register yourself. Compare how each one handles motion, storytelling and style.
          </p>
          <NextLink href="/models/" className="btn-white pointer-events-auto mt-6 h-[46px] md:h-[52px] px-6 rounded-12 text-14 md:text-16 font-semibold flex items-center gap-3">
            <Arrow size={16} /> Explore All
          </NextLink>
        </div>
        <div className="md:hidden no-scrollbar mt-8 flex gap-3 overflow-x-auto px-6">
          {CLOUD.map((c) => (
            <div key={c.name} className="shrink-0">
              <CloudCard c={c} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const USES = [
  { t: "Filmmakers & directors", scene: "golf" },
  { t: "Marketing agencies", scene: "green" },
  { t: "Content creators", scene: "creator" },
  { t: "E-commerce brands", scene: "product" },
];

export function UseCases() {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (d: number) => track.current?.scrollBy({ left: d * 456, behavior: "smooth" });
  return (
    <section className="min-h-[704px] md:min-h-0 overflow-hidden pt-[60px] md:pt-20 pb-10">
      <div className="max-w-col mx-auto px-4">
        <div className="flex flex-col md:flex-row md:items-center gap-10 md:gap-6 md:justify-between">
          <p className="text-12 md:text-18 font-medium text-soft leading-4 md:leading-[26px] max-w-[542px]">
            Whether you&apos;re directing a film, growing a brand or posting every day, Film Studio gives you the tools to make AI video that matches your
            vision and keeps production moving.
          </p>
          <NextLink href="/ai/video/" className="btn-white self-start md:self-auto h-12 px-8 md:px-6 rounded-12 text-14 md:text-16 font-semibold flex items-center gap-3 shrink-0">
            <Arrow size={16} /> Get started
          </NextLink>
        </div>
        <div ref={track} className="no-scrollbar mt-12 flex gap-4 overflow-x-auto -mr-[100vw] pr-[100vw]">
          {USES.map((u) => (
            <Scene key={u.t} name={u.scene} className="shrink-0 w-[272px] h-[324px] md:w-[440px] md:h-[600px] rounded-24">
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
              <div className="absolute left-6 right-6 bottom-6 flex items-end justify-between gap-4">
                <h3 className="font-display font-bold uppercase text-24 md:text-28 leading-[36px] max-w-[200px] md:max-w-[300px]">{u.t}</h3>
                <button aria-label={`More about ${u.t}`} className="w-[42px] h-10 shrink-0 rounded-full bg-white text-dark grid place-items-center">
                  <Plus size={14} />
                </button>
              </div>
            </Scene>
          ))}
        </div>
        <div className="mt-7">
          <Arrows onPrev={() => scroll(-1)} onNext={() => scroll(1)} />
        </div>
      </div>
    </section>
  );
}

export function useOpenStudio() {
  return useStudio((s) => s.set);
}
