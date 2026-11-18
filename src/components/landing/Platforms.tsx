"use client";
import NextLink from "next/link";
import { useStudio } from "@/lib/store";
import { useHydrated } from "../Hydrate";
import { Arrow, Check, Spark } from "../Icons";

type Card = {
  name: string;
  desc: string;
  stat: string;
  statNote: string;
  cta: string;
  href: string;
  tone: "dark" | "green" | "light" | "team";
  lists: { h: string; items: string[] }[];
};

const CARDS: Card[] = [
  {
    name: "MCP",
    desc: "Remote and local MCP servers",
    stat: "tools/list",
    statNote: "auto-discovered",
    cta: "Connect a server",
    href: "/settings/#platforms",
    tone: "dark",
    lists: [
      { h: "Remote servers", items: ["Streamable HTTP & SSE", "OAuth 2.1 or bearer tokens", "Generation & status tools"] },
      { h: "Local servers", items: ["mcpServers JSON config", "stdio through the local bridge", "Asset & character libraries"] },
      { h: "Live balance", items: ["check_balance / credit_check", "Synced before and after renders"] },
    ],
  },
  {
    name: "CLI",
    desc: "Creative tools already on your computer",
    stat: "argv only",
    statNote: "no shell, allow-list",
    cta: "Set up the bridge",
    href: "/settings/#bridge",
    tone: "green",
    lists: [
      { h: "Flag mapping", items: ["Canvas & Cinema Studio controls → CLI flags", "{model} {prompt} {aspect_ratio} {duration}", "Live progress from stdout"] },
      { h: "Outputs", items: ["Downloaded files land on the timeline", "Served locally by the bridge"] },
      { h: "Manual ledger", items: ["Daily or monthly allotment", "Estimated cost deducted per render"] },
    ],
  },
  {
    name: "API",
    desc: "Keys, tokens and webhooks",
    stat: "submit → poll",
    statNote: "→ fetch asset",
    cta: "Add an API platform",
    href: "/settings/#platforms",
    tone: "light",
    lists: [
      { h: "Encrypted vault", items: ["API keys & bearer tokens", "Session cookies & webhooks", "Never leave this device unencrypted"] },
      { h: "Job worker", items: ["submit_job", "poll_status", "fetch_asset_url"] },
      { h: "Zero-code wizard", items: ["Paste --help, a cURL or an MCP URL", "Claude writes the bridge module"] },
    ],
  },
  {
    name: "Router",
    desc: "Claude picks where every render runs",
    stat: "3 modes",
    statNote: "per shot & node",
    cta: "Open Cinema Studio",
    href: "/ai/video/",
    tone: "team",
    lists: [
      { h: "Cheapest available credit", items: ["Lowest cost above your reserve", "Spends expiring daily credits first"] },
      { h: "Platform feature lock", items: ["Pin camera presets or character libraries", "Automatic failover when credits run low"] },
      { h: "Pre-flight confirmation", items: ["Total burn across all platforms", "One-click approval for batches"] },
      { h: "Same-model arbitrage", items: ["One prompt, many hosts", "Identical payload on failover"] },
    ],
  },
];

const BOX: Record<Card["tone"], string> = {
  dark: "radial-gradient(ellipse at 50% 120%, #46515a 0%, #2a3136 60%)",
  green: "radial-gradient(ellipse at 50% 0%, #a6d11c 0%, #8db600 45%, #3f5200 100%)",
  light: "radial-gradient(ellipse at 50% 0%, #5b6b76 0%, #36404a 55%, #232a2f 100%)",
  team: "linear-gradient(180deg, #36404a 0%, #2a3136 100%)",
};

export default function Platforms() {
  const hydrated = useHydrated();
  const platforms = useStudio((s) => s.platforms);
  const total = platforms.filter((p) => p.enabled).reduce((a, p) => a + p.balance, 0);
  return (
    <section id="platforms" className="px-4 pt-[60px] pb-[60px] md:pt-[100px] md:pb-[90px] lg:min-h-[1914px]">
      <h2 className="font-display font-bold uppercase text-[44px] md:text-48 leading-[1.17] text-center">Bring your own credits</h2>
      <p className="mt-3 text-16 text-mute text-center">Use the subscriptions you already have. Connect any platform by MCP, CLI or API.</p>
      <div className="mt-10 flex justify-center">
        <NextLink href="/settings/#platforms" className="h-10 px-4 rounded-full border border-w10 flex items-center gap-2 text-12 font-semibold">
          <span className="w-2 h-2 rounded-full bg-lime" /> Studio wallet
          <span className="text-lime tabular-nums">{hydrated ? total.toLocaleString() : "—"} credits</span> across {platforms.length} platforms
        </NextLink>
      </div>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-6 max-w-[1404px] mx-auto">
        {CARDS.map((c) => (
          <article key={c.name} className="p-2">
            <div className="rounded-24 p-4 h-[266px] flex flex-col shadow-[0_8px_40px_rgba(0,0,0,.4)]" style={{ background: BOX[c.tone] }}>
              <h3 className="font-display text-36 font-medium leading-10 tracking-tight">{c.name}</h3>
              <p className="mt-2 text-14 font-medium text-white/70">{c.desc}</p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-36 font-medium">{c.stat}</span>
                <span className="text-14 text-white/70">{c.statNote}</span>
              </p>
              <NextLink href={c.href} className="mt-auto h-11 rounded-12 bg-white text-dark-2 text-14 font-semibold flex items-center justify-center gap-2">
                <Arrow size={14} /> {c.cta}
              </NextLink>
            </div>
            {c.lists.map((l) => (
              <section key={l.h} className="border-t border-w5 px-4 py-2 mt-4 flex flex-col gap-2">
                <h4 className="text-14 text-w40 leading-5 py-2">{l.h}</h4>
                {l.items.map((it) => (
                  <p key={it} className="text-14 flex items-center gap-3 min-h-6">
                    <Check size={16} className="text-lime shrink-0" /> {it}
                  </p>
                ))}
              </section>
            ))}
          </article>
        ))}
      </div>
      <p className="mt-10 text-12 text-w60 text-center leading-[18px] max-w-[900px] mx-auto flex items-center justify-center gap-2">
        <Spark size={12} className="text-lime" /> Platform names are shown only to label connections you set up yourself. Credit numbers start as samples until you enter your own.
      </p>
    </section>
  );
}
