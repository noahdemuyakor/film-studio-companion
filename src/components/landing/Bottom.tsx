"use client";
import NextLink from "next/link";
import { useRef, useState } from "react";
import Scene from "../Scene";
import { Arrow, Check, ChevronD, Cross, Diamond, Gift, Minus, Plus, Spark } from "../Icons";

type Item = { t: string; ok: boolean; hl?: boolean; tag?: string };
type Sec = { h: string; items: Item[] };
type Plan = {
  name: string;
  desc: string;
  old?: string;
  price: string;
  per: string;
  cta: string;
  save?: string;
  tone: "dark" | "lime" | "pink" | "team";
  credits: [string, string][];
  sections: Sec[];
  mins?: number[];
};

const PLANS: Plan[] = [
  {
    name: "Basic",
    desc: "For first-time AI filmmakers",
    price: "$9",
    per: "/mo, billed yearly",
    cta: "Get Basic",
    tone: "dark",
    mins: [172, 108, 224],
    credits: [["120 credits", "/ month"], ["60 images", "Nano Banana Pro"], ["7 videos", "Wan 2.7 drafts"]],
    sections: [
      { h: "No unlimited models", items: [{ t: "Nano Banana Pro", ok: false }, { t: "Flux.1 Pro", ok: false }, { t: "Stable Diffusion XL", ok: false }, { t: "No other unlimited models", ok: false }] },
      { h: "Free generations", items: [{ t: "Local engine breakdowns", ok: true }, { t: "Unlimited preview renders", ok: true }] },
      { h: "Included in plan", items: [{ t: "Credit top-ups with discount", ok: true }, { t: "2 parallel renders", ok: true }, { t: "Node canvas & timeline", ok: true }, { t: "Bring your own models", ok: true }, { t: "Early access to advanced AI features", ok: false }] },
    ],
  },
  {
    name: "Plus",
    desc: "For steady, easy AI content creation",
    old: "$49",
    price: "$27",
    per: "/mo, billed yearly",
    cta: "Get Plus",
    save: "Save $264",
    tone: "lime",
    mins: [222, 108, 204],
    credits: [["1,000 credits", "/ month"], ["500 images", "Nano Banana Pro"], ["67 videos", "Seedance 2.5"]],
    sections: [
      { h: "Unlimited models for 7 days", items: [{ t: "Unlimited Nano Banana Pro", ok: true, hl: true, tag: "2K" }, { t: "Unlimited Flux.1 Pro", ok: true, hl: true, tag: "2K" }, { t: "Unlimited SDXL", ok: true, hl: true, tag: "2K" }, { t: "5 other unlimited models", ok: true }] },
      { h: "Free generations", items: [{ t: "Claude Sonnet breakdowns", ok: true, hl: true, tag: "500/mo" }, { t: "Adapter generator", ok: true }] },
      { h: "Included in plan", items: [{ t: "Credit top-ups with discount", ok: true }, { t: "Unlimited parallel renders", ok: true }, { t: "All video models", ok: true }, { t: "Drama Studio & cast registry", ok: true }, { t: "Early access to advanced AI features", ok: true }] },
    ],
  },
  {
    name: "Ultra",
    desc: "For creators building AI series",
    old: "$129",
    price: "$50",
    per: "/mo, billed yearly",
    cta: "Get Ultra",
    save: "Save $948",
    tone: "pink",
    mins: [222, 108, 204],
    credits: [["3,000 credits", "/ month"], ["1,500 images", "Nano Banana Pro"], ["200 videos", "Seedance 2.5"]],
    sections: [
      { h: "Unlimited models for 7 days", items: [{ t: "Unlimited Nano Banana Pro", ok: true, hl: true, tag: "2K" }, { t: "Unlimited Flux.1 Pro", ok: true, hl: true, tag: "2K" }, { t: "Unlimited SDXL", ok: true, hl: true, tag: "2K" }, { t: "5 other unlimited models", ok: true }] },
      { h: "Free generations", items: [{ t: "Claude Opus breakdowns", ok: true, hl: true, tag: "2,000/mo" }, { t: "Adapter generator", ok: true }] },
      { h: "Included in plan", items: [{ t: "Credit top-ups with discount", ok: true }, { t: "Unlimited parallel renders", ok: true }, { t: "All video models", ok: true }, { t: "All studios & features", ok: true }, { t: "Early access to advanced AI features", ok: true }] },
    ],
  },
  {
    name: "Team",
    desc: "For agencies and small studios",
    old: "$79",
    price: "$45",
    per: "/seat/mo, yearly",
    cta: "Get Team",
    save: "Save $120",
    tone: "team",
    mins: [76, 238, 244, 172, 172],
    credits: [["2,000 plan credits", "per month"], ["1,000 credits", "per seat per month"], ["+400 bonus credits", "for each extra seat"]],
    sections: [
      { h: "14-day unlimited with business verification", items: [{ t: "Unlimited Seedance 2.5", ok: true, tag: "15s, 4K" }] },
      { h: "Unlimited models", items: [{ t: "Unlimited Nano Banana Pro", ok: true, tag: "2K" }, { t: "Unlimited Flux.1 Pro", ok: true, tag: "2K" }, { t: "Kling 4.0", ok: false }] },
      { h: "Included in plan", items: [{ t: "Unused credits roll over", ok: false }, { t: "2 to 9 members in one workspace", ok: true }, { t: "All features & models", ok: true }, { t: "Shared vault & credit pool", ok: true }, { t: "Early access to advanced AI features", ok: true }] },
      { h: "Admin & Control", items: [{ t: "Admin spend control", ok: false }, { t: "SSO", ok: false }, { t: "Delegated top-up access", ok: false }, { t: "Analytics & priority support", ok: true }] },
      { h: "Security & Compliance", items: [{ t: "Indemnification", ok: false }, { t: "No training on your data", ok: false }, { t: "SOC 2 security", ok: false }, { t: "Personal AI educator", ok: false }] },
    ],
  },
];

const TONE: Record<Plan["tone"], { box: string; accent: string; sub: string }> = {
  dark: { box: "radial-gradient(ellipse at 50% 120%, #46515a 0%, #2a3136 60%)", accent: "#ffffff", sub: "#ffffff66" },
  lime: { box: "radial-gradient(ellipse at 50% 0%, #a6d11c 0%, #7fa300 45%, #3f5200 100%)", accent: "#8db600", sub: "#d4ec8c" },
  pink: { box: "radial-gradient(ellipse at 50% 0%, #ff5ca0 0%, #ff005b 45%, #8a0838 100%)", accent: "#ff3d85", sub: "#ffd0e2" },
  team: { box: "linear-gradient(180deg, #36404a 0%, #2a3136 100%)", accent: "#8db600", sub: "#ffffff66" },
};

function PlanCard({ p, annual }: { p: Plan; annual: boolean }) {
  const t = TONE[p.tone];
  const [seats, setSeats] = useState(2);
  return (
    <article className="p-2">
      <div className="h-[468px] flex flex-col">
      <div className="rounded-24 p-4 h-[266px] shrink-0 flex flex-col shadow-[0_8px_40px_rgba(0,0,0,.4)]" style={{ background: t.box }}>
        <div className="flex items-center gap-2">
          <h2 className="font-display text-36 font-medium leading-10 tracking-tight">{p.name}</h2>
          {p.tone === "lime" && (
            <span className="text-12 font-semibold rounded-full bg-white/20 px-2 h-6 flex items-center gap-1">
              <Spark size={10} /> Most popular
            </span>
          )}
        </div>
        <p className="mt-2 text-14 font-medium" style={{ color: t.sub }}>
          {p.desc}
        </p>
        <div className={`${p.tone === "team" ? "mt-3" : "mt-5"} flex items-baseline gap-2`}>
          {p.old && annual && <span className="font-display text-36 font-medium line-through text-white/40">{p.old}</span>}
          <span className="font-display text-36 font-medium">{annual ? p.price : p.old || p.price}</span>
          <span className="text-14 text-white/70">{p.per}</span>
        </div>
        <button className="mt-auto shrink-0 h-11 rounded-12 bg-white text-dark-2 text-14 font-semibold flex items-center justify-center gap-2">
          {p.cta}
          {p.save && annual && <span className="rounded-full bg-[#ff005b] text-white text-12 px-2 py-0.5">{p.save}</span>}
        </button>
        {p.tone === "team" && (
          <div className="mt-2 shrink-0 h-11 rounded-12 bg-w10 flex items-center justify-between px-4 text-14 font-semibold">
            <button aria-label="Fewer seats" onClick={() => setSeats(Math.max(2, seats - 1))} className="text-w50">
              <Minus size={14} />
            </button>
            {seats} seats
            <button aria-label="More seats" onClick={() => setSeats(Math.min(9, seats + 1))}>
              <Plus size={14} />
            </button>
          </div>
        )}
        {(p.tone === "lime" || p.tone === "pink") && <p className="mt-3 text-12 text-white/60 text-center">ⓘ Unlimited gens apply inside Film Studio only</p>}
      </div>
      <ul className="px-4 pt-7 pb-6 flex flex-col gap-3">
        {p.credits.map(([a, b], k) => (
          <li key={a} className={`text-14 flex items-center gap-2 ${k ? "pl-7" : ""}`}>
            {k === 0 && (
              <span className="w-4 h-4 rounded-full grid place-items-center text-dark" style={{ background: t.accent }}>
                <Plus size={10} />
              </span>
            )}
            <span className="font-semibold" style={{ color: k === 0 ? t.accent : "#fff" }}>
              {a}
            </span>
            <span className="text-w60">{b}</span>
          </li>
        ))}
      </ul>
      </div>
      {p.sections.map((s, si) => (
        <section key={s.h} className="border-t border-w5 px-4 py-2 flex flex-col gap-2 lg:min-h-[var(--mh)]" style={{ ["--mh" as string]: `${p.mins?.[si] ?? 0}px` }}>
          <h3 className="text-14 text-w40 leading-5 py-2">{s.h}</h3>
          {s.items.map((it) => (
            <p key={it.t} className={`text-14 flex items-center gap-3 min-h-6 ${it.ok ? "text-white" : "text-w60"}`}>
              {it.ok ? (
                it.hl ? (
                  <span className="w-4 h-4 rounded-full grid place-items-center text-dark shrink-0" style={{ background: t.accent }}>
                    <Check size={10} />
                  </span>
                ) : (
                  <Check size={16} className="text-w50 shrink-0" />
                )
              ) : (
                <Cross size={16} className="text-w30 shrink-0" />
              )}
              <span className={it.hl ? "underline decoration-dotted underline-offset-4" : ""} style={it.hl ? { color: t.accent } : undefined}>
                {it.t}
              </span>
              {it.tag && <span className="text-10 font-semibold border border-w10 rounded-6 px-1.5">{it.tag}</span>}
            </p>
          ))}
          {s.h.startsWith("Unlimited") && (
            <button className="h-8 rounded-12 border border-w10 text-12 font-semibold flex items-center justify-center gap-1.5">Availability ⓘ</button>
          )}
        </section>
      ))}
    </article>
  );
}


type MPlan = {
  name: string;
  badges: string[];
  desc: string;
  credits: string;
  lines: string[];
  old?: string;
  price: string;
  per: string;
  cta: string;
  ctaClass: string;
  note: string;
  free?: boolean;
  unlimited: [string, string, string][];
  checks: [string, boolean][];
  yearly: [string, string][];
  wrap?: { label: string; color: string };
};

const MPLANS: MPlan[] = [
  {
    name: "Basic",
    badges: [],
    desc: "For first-time AI filmmakers",
    credits: "120 credits/mo.",
    lines: ["= 60 Nano Banana Pro images", "~ 7 Wan 2.7 draft videos"],
    price: "$9",
    per: "per month, billed annually",
    cta: "Get Plan",
    ctaClass: "bg-white text-dark-2",
    note: "No difference compared to monthly",
    unlimited: [["Nano Banana Pro", "", "No unlimited"], ["Flux.1 Pro", "", "No unlimited"], ["Stable Diffusion XL", "", "No unlimited"], ["No other unlimited models", "", ""]],
    checks: [["Parallel renders: up to 2 videos, 2 images", true], ["Node canvas, timeline & vault", true], ["Bring your own models & keys", true], ["Early access to new features", false], ["Credit top-ups with discount", true]],
    yearly: [["Local engine breakdowns", ""], ["Preview renders", ""], ["Cast registry", ""], ["Reference vault (50)", ""], ["Timeline export", ""], ["Model Hub", ""], ["Wallet bar", ""]],
  },
  {
    name: "Plus",
    badges: ["45% OFF", "CLAUDE SONNET"],
    desc: "For steady, easy AI content creation",
    credits: "1,000 credits/mo.",
    lines: ["= 500 Nano Banana Pro images", "~ 67 Seedance 2.5 videos"],
    old: "$49",
    price: "$27",
    per: "per month, billed annually",
    cta: "Get Plan",
    ctaClass: "btn-lime",
    note: "Save $264 compared to monthly",
    free: true,
    unlimited: [["Nano Banana Pro", "2K", "7-day unlimited"], ["Flux.1 Pro", "2K", "7-day unlimited"], ["Stable Diffusion XL", "2K", "7-day unlimited"]],
    checks: [["Unlimited parallel renders", true], ["All video models", true], ["Drama Studio & cast registry", true], ["Early access to new features", true], ["Credit top-ups with discount", true]],
    yearly: [["Showrunner breakdowns", "5,000 FREE"], ["Prompt compiler", "365 UNLIMITED"], ["Continuity guardian", "365 UNLIMITED"], ["Adapter generator", "365 UNLIMITED"], ["Credit router", "365 UNLIMITED"], ["Preview renders", "365 UNLIMITED"], ["Timeline export", "365 UNLIMITED"]],
  },
  {
    name: "Ultra",
    badges: ["60% OFF", "CLAUDE OPUS"],
    desc: "For creators building AI series",
    credits: "3,000 credits/mo.",
    lines: ["= 1,500 Nano Banana Pro images", "~ 200 Seedance 2.5 videos"],
    old: "$129",
    price: "$50",
    per: "per month, billed annually",
    cta: "Get Plan",
    ctaClass: "bg-[#ff1f78] text-white",
    note: "Save $948 compared to monthly",
    free: true,
    unlimited: [["Nano Banana Pro", "2K", "7-day unlimited"], ["Flux.1 Pro", "2K", "7-day unlimited"], ["Stable Diffusion XL", "2K", "7-day unlimited"]],
    checks: [["Unlimited parallel renders", true], ["All video models", true], ["All studios & features", true], ["Early access to new features", true], ["Credit top-ups with discount", true]],
    yearly: [["Showrunner breakdowns", "10,000 FREE"], ["Prompt compiler", "365 UNLIMITED"], ["Continuity guardian", "365 UNLIMITED"], ["Adapter generator", "365 UNLIMITED"], ["Credit router", "365 UNLIMITED"], ["Preview renders", "365 UNLIMITED"], ["Timeline export", "365 UNLIMITED"]],
    wrap: { label: "MOST POPULAR", color: "#ff1f78" },
  },
  {
    name: "Team",
    badges: ["43% OFF", "CLAUDE OPUS"],
    desc: "For agencies and small studios",
    credits: "2,000 credits in total/mo",
    lines: ["= 1,000 credits per seat/mo", "= 1,000 Nano Banana Pro images", "~ 133 Seedance 2.5 videos"],
    old: "$79",
    price: "$45",
    per: "per seat/mo, billed annually",
    cta: "Get Plan",
    ctaClass: "bg-[#1f4ff5] text-white",
    note: "Save $120 compared to monthly",
    unlimited: [],
    checks: [["2 to 9 members in one shared workspace", true], ["Parallel renders: up to 16 video & 16 image", true], ["All features & models", true], ["Shared credit pool & vault", true], ["Basic analytics & priority support", true], ["SSO & admin spend control", false], ["Indemnification & SOC 2", false]],
    yearly: [],
    wrap: { label: "BEST VALUE", color: "#1f4ff5" },
  },
];

function MobilePlan({ p, annual }: { p: MPlan; annual: boolean }) {
  const card = (
    <article className="rounded-16 bg-[#2c3439] border border-w5 p-4 flex flex-col gap-[22px]">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-display font-bold text-24 uppercase leading-7">{p.name}</h3>
          {p.badges.map((b, i) => (
            <span key={b} className={`text-[11px] font-bold italic px-1.5 rounded-[3px] ${i === 0 ? "bg-[#ff005b]" : "bg-gradient-to-r from-[#3b6cff] to-[#38c6ff]"}`}>
              {b}
            </span>
          ))}
        </div>
        <p className="mt-2 text-12 text-w50">{p.desc}</p>
      </div>
      <div className="rounded-12 bg-white/[.04] border border-w5 p-3">
        <p className="text-14 font-semibold flex items-center gap-1.5">
          <Spark size={12} /> {p.credits}
        </p>
        {p.lines.map((l) => (
          <p key={l} className="text-12 text-w60 pl-5 leading-[18px]">
            {l}
          </p>
        ))}
        <p className="mt-3 h-9 rounded-8 bg-w5 text-12 text-w60 flex items-center justify-center gap-1.5">
          <Check size={12} /> Fixed amount of {p.credits.split(" ")[0]} credits/mo
        </p>
      </div>
      <p className="flex items-baseline gap-2">
        {p.old && annual && <span className="font-display font-bold text-24 line-through text-[#ff005b]">{p.old}</span>}
        <span className="font-display font-bold text-24">{annual ? p.price : p.old || p.price}</span>
        <span className="text-12 text-w50">{p.per}</span>
      </p>
      <div className="rounded-12 bg-white/[.04]">
        <button className={`w-full h-12 rounded-12 text-14 font-semibold ${p.ctaClass}`}>{p.cta}</button>
        <p className="h-8 text-12 text-w50 flex items-center justify-center">{p.note}</p>
      </div>
      {p.free && (
        <div className="rounded-12 border border-lime/40 p-1.5 flex flex-col gap-1" style={{ background: "radial-gradient(ellipse at 50% 0%, #3f520066, #2c3439 70%)" }}>
          <p className="h-8 px-2 flex items-center justify-between text-12">
            <span className="font-display font-bold uppercase flex items-center gap-2">
              <Gift size={12} className="text-lime" /> Free generations
            </span>
            <span className="text-w50">Learn more</span>
          </p>
          <p className="h-9 rounded-8 bg-black/30 px-2 flex items-center gap-2 text-12">
            <Check size={12} /> Claude Showrunner
            <span className="ml-auto rounded-6 bg-w10 px-1.5">720p</span>
            <span className="rounded-6 bg-lime text-dark px-1.5 font-semibold">3 free runs</span>
          </p>
        </div>
      )}
      {p.unlimited.length > 0 && (
        <div className="rounded-12 border border-w5 bg-white/[.03] p-1.5">
          <p className="h-8 px-2 flex items-center justify-between text-12">
            <span className="font-display font-bold uppercase">Unlimited & free gens</span>
            <span className="text-w50">Learn more</span>
          </p>
          {p.unlimited.map(([n, tag, chip]) => {
            const off = chip.startsWith("No") || !chip;
            return (
              <p key={n} className="h-10 px-2 border-t border-w5 flex items-center gap-2 text-12">
                {off ? <Cross size={11} className="text-w30" /> : <Check size={11} />}
                <span className={off ? "text-w50" : ""}>{n}</span>
                {tag && <span className="ml-auto rounded-6 bg-w10 px-1.5 font-semibold">{tag}</span>}
                {chip && <span className={`${tag ? "" : "ml-auto"} rounded-6 px-1.5 font-semibold ${chip.startsWith("No") ? "bg-w10 text-w60" : "bg-lime text-dark"}`}>{chip}</span>}
              </p>
            );
          })}
        </div>
      )}
      <ul className="flex flex-col gap-3 px-1">
        {p.checks.map(([t, ok]) => (
          <li key={t} className={`text-12 flex items-center gap-2 ${ok ? "" : "text-w40"}`}>
            {ok ? <Check size={12} /> : <Cross size={12} />} {t}
          </li>
        ))}
      </ul>
      {p.yearly.length > 0 && (
        <div className="px-1">
          <p className="font-display font-bold uppercase text-14 mb-2">365-day unlimited & free gens</p>
          <ul className="flex flex-col gap-3">
            {p.yearly.map(([t, chip]) => (
              <li key={t} className={`text-12 flex items-center gap-2 ${chip ? "" : "text-w40"}`}>
                {chip ? <Check size={12} /> : <Cross size={12} />} {t}
                {chip && <span className={`ml-auto rounded-6 px-1.5 text-[10px] font-semibold ${chip.includes("FREE") ? "bg-white text-dark" : "bg-lime text-dark"}`}>{chip}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
  if (!p.wrap) return card;
  return (
    <div className="rounded-[20px] p-[3px] pt-0" style={{ background: p.wrap.color }}>
      <p className="h-8 flex items-center justify-center gap-2 text-12 font-bold">
        <Diamond size={12} /> {p.wrap.label}
      </p>
      {card}
    </div>
  );
}


export function Pricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <section id="pricing" className="lg:min-h-[1914px] px-4 pt-[60px] pb-[60px] md:pt-[100px] md:pb-[90px]">
      <h2 className="font-display font-bold uppercase text-[44px] md:text-48 leading-[1.17] text-center">Pick your plan</h2>
      <p className="mt-3 text-16 text-mute text-center">More generations and early access to new studio features</p>
      <div className="md:hidden mt-10 rounded-24 border border-w5 p-4 flex flex-col gap-4" style={{ background: "linear-gradient(180deg,#2a3136,#232a2f)" }}>
        <div className="flex items-center justify-center gap-3 text-14 font-semibold">
          <button onClick={() => setAnnual(false)} className={annual ? "text-w50" : "text-white"}>
            Monthly
          </button>
          <button aria-label="Toggle billing period" onClick={() => setAnnual(!annual)} className="w-9 h-5 rounded-full bg-[#5a5d62] relative">
            <span className={`absolute top-[2px] w-4 h-4 rounded-full bg-white transition-all ${annual ? "left-[18px]" : "left-[2px]"}`} />
          </button>
          <button onClick={() => setAnnual(true)} className={annual ? "text-white" : "text-w50"}>
            Annual
          </button>
          <span className="text-[11px] font-bold italic px-1.5 rounded-[3px] bg-[#ff005b]">45% OFF</span>
        </div>
        {MPLANS.map((p) => (
          <MobilePlan key={p.name} p={p} annual={annual} />
        ))}
      </div>
      <div className="hidden md:flex mt-10 justify-center">
        <div className="h-10 px-4 rounded-full border border-w5 flex items-center gap-2 text-12 font-semibold">
          <button onClick={() => setAnnual(false)} className={annual ? "text-w50" : "text-white"}>
            Monthly
          </button>
          <button aria-label="Toggle billing" onClick={() => setAnnual(!annual)} className="w-8 h-[18px] rounded-full bg-white relative">
            <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-[#36404a] transition-all ${annual ? "left-[16px]" : "left-[2px]"}`} />
          </button>
          <button onClick={() => setAnnual(true)} className={annual ? "text-white" : "text-w50"}>
            Annual
          </button>
          <span className="text-lime">Save up to 65%</span>
        </div>
      </div>
      <div className="hidden md:grid mt-6 md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-6 max-w-[1404px] mx-auto">
        {PLANS.map((p) => (
          <PlanCard key={p.name} p={p} annual={annual} />
        ))}
      </div>
      <p className="mt-6 md:mt-10 text-12 text-w60 text-center leading-[18px] max-w-[900px] mx-auto rounded-16 md:rounded-none bg-w5 md:bg-transparent p-4 md:p-0">
        Unlimited models and free generations apply inside Film Studio Companion only, not through external API keys you bring yourself.
        <br />
        Prices exclude VAT and local taxes, calculated at checkout. Unlimited usage may slow down during peak hours. <span className="underline">Learn more</span>
        <br />
        New models and features may roll out gradually and not reach every account on launch day.
      </p>
    </section>
  );
}

const POSTS = [
  { t: "Turn product photos into AI video ads in an afternoon", scene: "portal" },
  { t: "Breaking down a one-minute AI short, shot by shot", scene: "city" },
  { t: "A full car commercial workflow with frame locking", scene: "racecar" },
  { t: "Realistic VFX shots with timecoded prompts", scene: "fire" },
  { t: "Ten vertical-drama formats you can make without filming", scene: "creator" },
  { t: "Editing real footage with motion transfer", scene: "ice" },
  { t: "Draft vs final: when to switch models", scene: "dusk" },
  { t: "Directing an AI short like a filmmaker", scene: "cafe" },
];

export function Blog() {
  const track = useRef<HTMLDivElement>(null);
  return (
    <section className="overflow-hidden">
      <div className="min-h-[774px] md:min-h-[909px] lg:min-h-[641px] max-w-col mx-auto px-4 py-10 md:py-20 lg:py-[140px] flex flex-col lg:flex-row gap-10 lg:gap-14">
        <div className="lg:w-[590px] shrink-0 flex flex-col items-center text-center lg:items-start lg:text-left">
          <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17]">Get insights from experts blog</h2>
          <p className="mt-4 lg:mt-6 text-12 md:text-18 text-mute leading-4 md:leading-[26px]">
            Get the know-how you need. Our team shares practical tricks, breaks down new models and writes step-by-step guides to help you plan, shoot and
            cut better AI films.
          </p>
          <a href="#faq" className="btn-white mt-6 lg:mt-[90px] h-[46px] px-3 rounded-12 text-14 md:text-16 font-semibold flex items-center">Read the FAQ</a>
        </div>
        <div ref={track} className="no-scrollbar flex gap-6 overflow-x-auto -mr-[100vw] pr-[100vw]">
          {POSTS.map((p) => (
            <article key={p.t} className="shrink-0 w-[318px] md:w-[412px] h-[346px] rounded-24 bg-w5 p-1 border border-w5">
              <Scene name={p.scene} className="h-[234px] rounded-[20px]" />
              <h3 className="px-4 pt-[34px] md:pt-4 text-20 font-medium leading-7 line-clamp-2">{p.t}</h3>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const FAQ = [
  ["What is AI video generation?", "AI video generation means creating video with artificial intelligence models. Instead of filming with a camera, you describe what you want with a text prompt, reference images or both, and the model produces a clip. Film Studio Companion goes further than prompt-to-video by giving you control over the camera, character consistency, optical style and editing."],
  ["Which AI video models can I use?", "If you link a Higgsfield account under Settings → Connected Platforms, Film Studio Companion can route renders to the models that account offers — for example Seedance, Kling, Veo, Wan and MiniMax — and spend its credits. Seedance 2.5, Kling 3.0/4.0, Veo 3.1, Omni Flash, Wan 2.7 and MiniMax H3 are also pre-configured in the Model Hub for your own API keys, and you can register any other model by pasting its documentation."],
  ["What is Cinema Studio?", "Cinema Studio is the workspace for cinematic shots. Choose a camera body, lens, focal length and aperture, stack camera moves, set the tempo and lighting, and lock the first and last frames between shots. Claude compiles all of it into the prompt syntax each model understands best."],
  ["Do I need video editing experience?", "No. The Showrunner breaks a story into scenes and shots for you, and the built-in timeline lays generated clips, dialogue, effects and music out automatically. You can trim and rearrange if you want to, but you never have to leave the app."],
  ["Can I use my own images or videos as input?", "Yes. Add characters, props, locations, styles and audio to the Reference Vault (up to 50 items) and connect them to any shot. Models that support image-to-video, first/last frames or character references receive them automatically."],
  ["What can I use AI-generated videos for?", "Short dramas, social content, ads, pitches, previs and storyboards, music videos and more. Check the licence of each model provider you connect for commercial terms."],
  ["How is Film Studio different from other AI video generators?", "It combines a node canvas, a cinema control panel, a drama writers' room and a timeline in one place, and lets you plug in any model. Claude acts as the brain that keeps prompts, continuity and structure consistent across all of them."],
  ["What video quality and formats does Film Studio support?", "Whatever your connected models produce, typically 720p to 4K in 9:16, 21:9, 16:9 or 1:1. The timeline exports an edit list, subtitles and a WebM animatic of the cut."],
  ["Is Film Studio free to use?", "You can use the whole studio with the local engine and preview renders at no cost. Real renders use your own provider keys or plan credits, and the live Power Engine uses your Claude API key."],
  ["How much does it cost to generate an AI video on Film Studio?", "Every Generate button shows an estimate from the model's registry entry: a base cost plus a per-second rate. Use cheap draft models for blocking and switch to final models for the hero takes."],
  ["Can I use AI-generated videos commercially?", "Commercial use depends on the terms of the model providers you connect. Film Studio Companion doesn't claim ownership of anything you make."],
];

export function Faq() {
  return (
    <section id="faq" className="min-h-[1148px] md:min-h-[924px] lg:min-h-[900px] px-4 md:px-10 pt-10 md:pt-20 pb-[60px] md:pb-[120px]">
      <div className="max-w-faq mx-auto">
        <header>
          <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17] text-center">Frequently asked questions</h2>
        </header>
        <div className="mt-12 md:mt-[60px] flex flex-col gap-4">
          {FAQ.map(([q, a], i) => (
            <section key={q}>
              <details className="group" open={i === 0}>
                <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer w-full flex items-center justify-between gap-6 text-left">
                  <h3 className="text-20 font-semibold leading-6 tracking-[-0.02em]">{q}</h3>
                  <Plus size={18} className="text-w50 shrink-0 group-open:hidden" />
                  <Minus size={18} className="text-w50 shrink-0 hidden group-open:block" />
                </summary>
                <p className="mt-3 mb-2 text-16 text-mute leading-6">{a}</p>
              </details>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

const MORE = [
  { t: "Node Canvas", href: "/canvas/", scene: "portal" },
  { t: "Drama Studio", href: "/short-drama/", scene: "cafe" },
  { t: "Audio & Voices", href: "/audio/", scene: "dusk" },
  { t: "Image Studio", href: "/ai/image/", scene: "sky" },
  { t: "Model Hub", href: "/models/", scene: "city" },
];

export function MoreFeatures() {
  return (
    <section className="py-20 overflow-hidden">
      <div className="max-w-[1536px] mx-auto px-4">
        <h2 className="font-display font-bold uppercase text-28 md:text-40 lg:text-48 leading-[1.17] text-center">Explore more AI features</h2>
        <div className="no-scrollbar mt-10 grid grid-flow-col auto-cols-[260px] md:auto-cols-[calc((100%-48px)/3)] lg:auto-cols-[calc((100%-64px)/5)] gap-4 overflow-x-auto">
          {MORE.map((m) => (
            <NextLink key={m.t} href={m.href} className="block">
              <Scene name={m.scene} className="h-[264px] rounded-24">
                <span className="absolute left-5 bottom-5 right-5 flex items-center justify-between font-display font-bold uppercase text-24">
                  {m.t} <Arrow size={20} />
                </span>
              </Scene>
            </NextLink>
          ))}
        </div>
      </div>
    </section>
  );
}

export { ChevronD, Gift };
