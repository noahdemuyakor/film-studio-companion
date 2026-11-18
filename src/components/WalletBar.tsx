"use client";
import NextLink from "next/link";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { useHydrated } from "./Hydrate";
import { syncBalance } from "@/lib/bridge";
import { Rerun } from "./Icons";

/** Studio Wallet Bar: total credits across linked platforms, with a per-platform breakdown. */
export default function WalletBar({ compact }: { compact?: boolean }) {
  const hydrated = useHydrated();
  const platforms = useStudio((s) => s.platforms);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  const live = platforms.filter((p) => p.enabled);
  const total = live.reduce((a, p) => a + p.balance, 0);
  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Studio wallet"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`h-6 px-2 rounded-6 bg-panel-2 flex items-center gap-1.5 text-12 font-semibold tabular-nums ${compact ? "" : ""}`}
      >
        <span className="w-2 h-2 rounded-full bg-lime" />
        {hydrated ? total.toLocaleString() : "—"} cr
      </button>
      {open && (
        <div className="absolute right-0 top-8 w-[300px] rounded-16 bg-pop border border-w10 p-3 shadow-2xl z-50">
          <div className="flex items-center justify-between">
            <p className="text-14 font-semibold">Studio Wallet</p>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await Promise.all(useStudio.getState().platforms.filter((p) => p.enabled && p.status === "connected").map(syncBalance));
                setBusy(false);
              }}
              className="text-12 text-w60 flex items-center gap-1"
            >
              <Rerun size={12} className={busy ? "spin" : ""} /> Sync live
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-1">
            {live.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-12 h-7">
                <span className={`w-1.5 h-1.5 rounded-full ${p.status === "connected" ? "bg-lime" : p.status === "error" ? "bg-pink" : "bg-w30"}`} />
                <span className="flex-1 truncate">{p.name}</span>
                <span className="text-w40">{p.balanceSource === "live" ? "live" : p.sample ? "sample" : "ledger"}</span>
                <span className="w-16 text-right tabular-nums font-semibold">{p.balance.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <NextLink href="/settings/#platforms" className="mt-3 h-8 rounded-8 bg-w10 text-12 font-semibold flex items-center justify-center">
            Manage platforms & wallets
          </NextLink>
        </div>
      )}
    </div>
  );
}
