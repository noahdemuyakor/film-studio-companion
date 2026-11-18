"use client";
import NextLink from "next/link";
import { useState } from "react";
import { Building, Close, Crown, Logo, Tag } from "./Icons";
import WalletBar from "./WalletBar";
import { useHydrated } from "./Hydrate";
import { useStudio } from "@/lib/store";

type Badge = { text: string; tone: "lime" | "gray" };
const NAV: { label: string; href: string; key: string; badge?: Badge; sep?: boolean }[] = [
  { label: "Explore", href: "/", key: "explore" },
  { label: "Image", href: "/ai/image/", key: "image" },
  { label: "Video", href: "/ai/video/", key: "video" },
  { label: "Audio", href: "/audio/", key: "audio" },
  { label: "MCP", href: "/settings/#platforms", key: "platforms" },
  { label: "API", href: "/models/", key: "models", sep: true },
  { label: "Cinema Studio", href: "/ai/video/", key: "cinema" },
  { label: "Canvas", href: "/canvas/", key: "canvas", badge: { text: "Top", tone: "lime" } },
  { label: "Short Drama", href: "/short-drama/", key: "drama", badge: { text: "New", tone: "gray" } },
  { label: "Model Hub", href: "/models/", key: "hub", badge: { text: "100+", tone: "gray" } },
  { label: "Timeline", href: "/short-drama/#timeline", key: "timeline" },
  { label: "Vault", href: "/ai/video/#vault", key: "vault" },
  { label: "Engine", href: "/settings/", key: "engine" },
  { label: "Cookies", href: "/cookie-notice/", key: "cookies" },
];

/** Real engine status for the top bar: is Claude connected, and do Generate buttons spend real credits? */
function useEngineStatus() {
  const hydrated = useHydrated();
  const connected = useStudio((s) => !!(s.claudeKeyEnc || s.bridgeTokenEnc));
  const live = useStudio((s) => s.liveRenders);
  return { hydrated, connected, live };
}

function PromoBar({ slim, noLg }: { slim?: boolean; noLg?: boolean }) {
  const [open, setOpen] = useState(true);
  const { hydrated, connected, live } = useEngineStatus();
  if (!open || !hydrated) return null;
  return (
    <>
      <header
        className={`relative hidden md:block overflow-hidden h-10 ${slim ? "lg:h-5" : ""} ${noLg ? "lg:hidden" : ""}`}
        style={{ background: "linear-gradient(90deg,#5f7d00 0%,#8db600 50%,#5f7d00 100%)" }}
      >
        <div className="flex items-center gap-2 h-10 mx-4">
        <div className="flex items-center gap-2 rounded-8 bg-black/80 h-6 px-2 shrink-0">
          <span className={`w-2 h-2 rounded-full ${connected ? "bg-lime" : "bg-pink"}`} />
          <span className="text-12 font-semibold">{connected ? "Claude connected" : "Claude not connected"}</span>
          <span className="text-12 text-w50">·</span>
          <span className="text-12 font-semibold">{live ? "Live: Generate spends credits" : "Preview: no credits spent"}</span>
        </div>
        <p className="text-14 font-semibold truncate">
          {connected
            ? "The Claude Power Engine plans every shot; you choose which platform's credits pay."
            : "Start the local bridge and save its token in Settings to switch on the Claude Power Engine."}
        </p>
        <div className="ml-auto flex items-center gap-3 shrink-0">
          <NextLink href="/settings/" className="rounded-full bg-white text-dark text-12 font-semibold h-6 px-3 flex items-center">
            {connected ? "Engine settings" : "Connect Claude"}
          </NextLink>
          <button aria-label="Close status bar" onClick={() => setOpen(false)} className="text-white/80">
            <Close size={16} />
          </button>
        </div>
        </div>
      </header>
      <header className={`${slim ? "hidden" : "flex"} md:hidden bg-lime text-dark-2 text-14 font-semibold leading-[18px] h-[52px]`}>
        <div className="flex items-start gap-2 mx-3 my-2">
          <Tag size={16} className="mt-0.5 shrink-0" />
          <span>{connected ? `Claude connected · ${live ? "Live renders spend credits" : "Preview mode, no credits spent"}` : "Connect Claude to switch on the live Power Engine"}</span>
        </div>
      </header>
    </>
  );
}

export default function SiteHeader({ active, promo = "none", mobile = "home" }: { active?: string; promo?: "none" | "app" | "slim" | "app-md"; mobile?: "home" | "doc" }) {
  return (
    <div className="relative z-40">
      {promo !== "none" && <PromoBar slim={promo === "slim"} noLg={promo === "app-md"} />}
      {/* desktop / tablet */}
      <header className={`hidden md:flex h-9 items-center gap-2 text-soft ${promo === "slim" ? "bg-ink" : "bg-ink"}`}>
        <NextLink href="/" aria-label="Film Studio Companion home" className="shrink-0 w-5 h-5 ml-4">
          <Logo size={20} />
        </NextLink>
        <nav className="nav-fade min-w-0 flex-1 overflow-hidden" aria-label="Main">
          <ul className="flex items-center whitespace-nowrap">
            {NAV.map((n) => (
              <li key={n.key} className="flex items-center">
                <NextLink
                  href={n.href}
                  className={`flex items-center gap-1 h-7 px-2 text-14 font-medium transition-colors hover:text-white ${active === n.key ? "text-lime" : "text-w30"}`}
                >
                  {n.label}
                  {n.badge && (
                    <span className={`text-10 font-semibold rounded-6 px-1 leading-[14px] ${n.badge.tone === "lime" ? "bg-[#8db6003d] text-lime" : "bg-w10 text-w50"}`}>
                      {n.badge.text}
                    </span>
                  )}
                </NextLink>
                {n.sep && <span className="mx-1 h-3 w-px bg-w10" />}
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3 shrink-0 mr-4">
          <WalletBar />
          <NextLink href="/settings/" className="hidden lg:flex items-center gap-1 h-6 text-14 font-medium text-w30 hover:text-white">
            <Building size={13} /> Enterprise
          </NextLink>
          <NextLink href="/settings/#platforms" className="h-6 px-2 rounded-6 text-14 font-semibold text-lime bg-[#8db60026] flex items-center">Platforms</NextLink>
          <NextLink href="/short-drama/" className="h-6 px-2 rounded-6 text-14 font-semibold text-dark-2 bg-lime flex items-center">New project</NextLink>
        </div>
      </header>
      {/* phone */}
      <header className="md:hidden flex h-[52px] items-center gap-3 bg-ink">
        <NextLink href="/" className="flex items-center gap-2 shrink-0 ml-4">
          <Logo size={32} />
          <span className="text-18 font-semibold tracking-tight">FilmStudio</span>
        </NextLink>
        {mobile === "home" ? (
          <div className="ml-auto mr-4 flex items-center gap-2">
            <NextLink href="/canvas/" aria-label="Canvas" className="w-9 h-9 grid place-items-center">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" /></svg>
            </NextLink>
            <NextLink href="/ai/video/" className="h-9 px-3 rounded-10 bg-panel-2 flex items-center gap-1.5 text-14 font-semibold">
              <Crown size={14} className="text-lime" /> Studio
            </NextLink>
            <NextLink href="/short-drama/" className="h-9 px-2.5 rounded-10 bg-lime text-dark-2 text-14 font-semibold flex items-center">New</NextLink>
          </div>
        ) : (
          <div className="ml-auto mr-4 flex items-center gap-2">
            <NextLink href="/settings/" className="h-9 px-3 rounded-10 bg-white text-dark-2 text-14 font-semibold flex items-center">Settings</NextLink>
            <NextLink href="/short-drama/" className="h-9 px-3 rounded-10 bg-lime text-dark-2 text-14 font-semibold flex items-center">New project</NextLink>
          </div>
        )}
      </header>
    </div>
  );
}
