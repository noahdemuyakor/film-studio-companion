"use client";
import { useRef, useState } from "react";
import { useStudio, VAULT_LIMIT, modelById } from "@/lib/store";
import type { RefKind, RouteMode, Shot } from "@/lib/types";
import { artGradient, fileToDataUrl, uid } from "@/lib/util";
import { Badge, Select } from "../ui";
import { Copy, Film, Link, Plus, Rerun, Trash } from "../Icons";

/** Clip lengths to offer for a video model: the exact ones its platforms accept, else common lengths up to its maximum (30 s at most). */
export function durationOptions(m: { durations?: number[]; maxDuration?: number }) {
  if (m.durations?.length) return m.durations.filter((d) => d <= 30);
  return [3, 4, 5, 6, 8, 10, 12, 15, 20, 25, 30].filter((d) => d <= (m.maxDuration || 10));
}

/** Resolutions to offer for a model: the ones its platforms accept, else a common set. */
export function resolutionOptions(m: { resolutions?: string[]; kind?: string }) {
  if (m.resolutions?.length) return m.resolutions;
  return m.kind === "image" ? ["1K", "2K", "4K"] : ["360p", "480p", "720p", "1080p", "2K", "4K"];
}
/** the offered resolution closest to the current setting (so the picker never shows a blank) */
export function nearestRes(cur: string, opts: string[]) {
  const h = (r: string) => (/^(\d+)p$/i.test(r) ? Number(r.slice(0, -1)) : ({ "1K": 1024, "2K": 1440, "4K": 2160, "8K": 4320 } as Record<string, number>)[r.toUpperCase()] || 0);
  if (opts.includes(cur)) return cur;
  return opts.reduce((a, b) => (Math.abs(h(b) - h(cur)) < Math.abs(h(a) - h(cur)) ? b : a), opts[0]);
}

export function aspectRatioCss(a: string) {
  const [w, h] = a.split(":").map(Number);
  return `${w} / ${h}`;
}

export function Preview({ shot, className = "" }: { shot: Shot; className?: string }) {
  const isVideo = shot.resultUrl && /\.(mp4|webm|mov)(\?|$)/i.test(shot.resultUrl);
  return (
    <div className={`relative overflow-hidden rounded-12 bg-ink-2 ${className}`} style={{ aspectRatio: aspectRatioCss(shot.settings.aspect) }}>
      {shot.resultUrl ? (
        isVideo ? (
          <video src={shot.resultUrl} controls className="w-full h-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.resultUrl} alt={shot.title} className="w-full h-full object-cover" />
        )
      ) : (
        <div className="absolute inset-0" style={{ background: artGradient(shot.seed) }} />
      )}
      {(shot.status === "compiling" || shot.status === "rendering") && (
        <div className="absolute inset-0 shimmer grid place-items-center text-12 font-semibold">{shot.status === "compiling" ? "Claude is compiling…" : "Rendering…"}</div>
      )}
      {shot.status === "done" && shot.simulated && (
        <span className="absolute left-2 top-2 text-10 font-semibold bg-black/60 rounded-6 px-1.5 py-0.5">Preview render</span>
      )}
      {shot.status === "error" && <div className="absolute inset-0 bg-black/70 p-3 text-12 text-[#ff5c9a]">{shot.error}</div>}
    </div>
  );
}

export function ShotCard({ shot, onRerun, onChain, onTimeline, onDelete }: { shot: Shot; onRerun?: () => void; onChain?: () => void; onTimeline?: () => void; onDelete?: () => void }) {
  const models = useStudio((s) => s.models);
  const platforms = useStudio((s) => s.platforms);
  const m = modelById(models, shot.modelId);
  const pf = platforms.find((p) => p.id === shot.platformId);
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-16 bg-[#232a2f] border border-w5 p-2 flex flex-col gap-2">
      <Preview shot={shot} />
      <div className="px-1 flex flex-wrap items-center gap-1.5 text-12">
        <span className="font-semibold">{shot.title}</span>
        <Badge>{m?.name}</Badge>
        {pf && <Badge tone="lime">via {pf.name}</Badge>}
        <Badge tone={shot.engine === "live" ? "lime" : "gray"}>{shot.engine === "live" ? "Claude" : "local engine"}</Badge>
        <span className="ml-auto text-w50">{shot.credits} cr</span>
      </div>
      {shot.route && <p className="px-1 text-10 text-w40">{shot.route}</p>}
      {shot.compiled && (
        <button onClick={() => setOpen(!open)} className="px-1 text-left text-12 text-w60 leading-4">
          <span className={open ? "" : "line-clamp-3"}>{shot.compiled}</span>
        </button>
      )}
      {open && shot.continuity && <p className="px-1 text-10 text-w40 leading-4">Continuity: {shot.continuity}</p>}
      <div className="flex items-center gap-1 text-12 font-semibold px-1 pb-1">
        {onRerun && (
          <button onClick={onRerun} className="flex items-center gap-1 h-7 px-2 rounded-6 hover:bg-w10">
            <Rerun size={12} /> Rerun
          </button>
        )}
        {onChain && (
          <button onClick={onChain} title="Use this shot's last frame as the next shot's first frame" className="flex items-center gap-1 h-7 px-2 rounded-6 hover:bg-w10">
            <Link size={12} /> Chain next
          </button>
        )}
        {onTimeline && (
          <button onClick={onTimeline} className="flex items-center gap-1 h-7 px-2 rounded-6 hover:bg-w10">
            <Film size={12} /> To timeline
          </button>
        )}
        <button aria-label="Copy prompt" onClick={() => navigator.clipboard?.writeText(shot.compiled)} className="ml-auto h-7 w-7 grid place-items-center rounded-6 hover:bg-w10">
          <Copy size={12} />
        </button>
        {onDelete && (
          <button aria-label="Delete" onClick={onDelete} className="h-7 w-7 grid place-items-center rounded-6 hover:bg-w10">
            <Trash size={12} />
          </button>
        )}
      </div>
    </article>
  );
}

/** Live renders spend real credits on the chosen platform; off = free previews (Claude still writes the prompt). */
export function LiveToggle() {
  const live = useStudio((s) => s.liveRenders);
  const set = useStudio((s) => s.set);
  return (
    <label
      title={live ? "Live: real renders, paid from the platform's credits" : "Preview: nothing is rendered or spent"}
      className={`h-8 px-2 rounded-8 flex items-center gap-1.5 text-12 font-semibold cursor-pointer ${live ? "bg-lime text-dark" : "bg-w5 text-w60"}`}
    >
      <input type="checkbox" className="accent-[#1b2024]" checked={live} onChange={(e) => set({ liveRenders: e.target.checked })} />
      {live ? "Live" : "Preview"}
    </label>
  );
}

/** Short label for one platform in a "Pay with" list: name, balance and anything that stops it being used. */
function payLabel(p: { name: string; balance: number; enabled: boolean; status: string }, modelOk: boolean | null) {
  const note = !p.enabled ? " · switched off" : modelOk === false ? " · doesn't offer this model" : p.status !== "connected" ? " · not connected (preview only)" : "";
  return `${p.name} · ${p.balance.toLocaleString()} cr${note}`;
}

/**
 * Whose credits pay for a generation: Auto (cheapest credit), a platform the person chooses (never swapped for another),
 * or Auto with a cost check before batch renders. Pass modelId to flag platforms that don't offer that model.
 */
export function RouteSelector({ mode, lock, onChange, compact, modelId }: { mode: RouteMode; lock: string; onChange: (m: RouteMode, lock: string) => void; compact?: boolean; modelId?: string }) {
  const platforms = useStudio((s) => s.platforms);
  const modes: { id: RouteMode; label: string }[] = [
    { id: "cheapest", label: compact ? "Auto" : "Auto · cheapest" },
    { id: "lock", label: "I choose" },
    { id: "preflight", label: compact ? "Pre-flight" : "Pre-flight check" },
  ];
  const offers = (p: (typeof platforms)[number]) => (modelId ? p.models[modelId] !== undefined : null);
  const chosen = platforms.find((p) => p.id === lock);
  const warn = mode === "lock" && (!chosen ? "Pick whose credits pay." : !chosen.enabled ? `${chosen.name} is switched off in Settings.` : offers(chosen) === false ? `${chosen.name} doesn't offer this model.` : "");
  const list = [...platforms].sort((a, b) => Number(b.enabled) - Number(a.enabled) || Number(offers(b) !== false) - Number(offers(a) !== false) || b.balance - a.balance);
  return (
    <div className="flex flex-col gap-1.5" aria-label="Pay with">
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-8 bg-w5">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id, m.id === "lock" && !lock ? list.find((p) => p.enabled && offers(p) !== false)?.id || "" : lock)}
            className={`h-7 rounded-6 text-[11px] font-semibold ${mode === m.id ? "bg-w10 text-white" : "text-w50"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === "lock" && (
        <div className="rounded-8 bg-w5 px-2 h-8 flex items-center">
          <Select
            label="Pay with"
            value={lock}
            onChange={(v) => onChange("lock", v)}
            options={[{ id: "", label: "Pay with…" }, ...list.map((p) => ({ id: p.id, label: payLabel(p, offers(p)) }))]}
            className="text-12"
          />
        </div>
      )}
      {warn && <p className="text-[10px] text-[#ff5c9a]">{warn}</p>}
      {!compact && <LiveToggle />}
    </div>
  );
}

/** Compact "Pay with" picker for prompt bars: Auto (cheapest credit) or one platform, which is then always used. */
export function PayWith({ modelId }: { modelId?: string }) {
  const st = useStudio();
  const offers = (p: (typeof st.platforms)[number]) => (modelId ? p.models[modelId] !== undefined : null);
  const value = st.routeMode === "lock" ? st.lockPlatform : "";
  const list = [...st.platforms].sort((a, b) => Number(b.enabled) - Number(a.enabled) || Number(offers(b) !== false) - Number(offers(a) !== false) || b.balance - a.balance);
  const chosen = st.platforms.find((p) => p.id === value);
  const bad = chosen && (!chosen.enabled || offers(chosen) === false);
  return (
    <>
    <LiveToggle />
    <span className={`h-8 px-2 rounded-8 bg-w5 flex items-center gap-1 text-12 font-semibold ${bad ? "ring-1 ring-[#ff5c9a]" : ""}`} title={bad ? `${chosen!.name} can't run this model — pick another` : "Whose credits pay for this generation"}>
      <span className="text-w50">Pay with</span>
      <Select
        label="Pay with"
        value={value}
        onChange={(v) => st.set(v ? { routeMode: "lock", lockPlatform: v } : { routeMode: "cheapest" })}
        options={[{ id: "", label: "Auto · cheapest" }, ...list.map((p) => ({ id: p.id, label: payLabel(p, offers(p)) }))]}
        className="text-12"
      />
    </span>
    </>
  );
}

const KINDS: RefKind[] = ["character", "prop", "location", "style", "audio"];

export function Vault({ selected, onToggle }: { selected: string[]; onToggle: (id: string) => void }) {
  const vault = useStudio((s) => s.vault);
  const update = useStudio((s) => s.update);
  const [kind, setKind] = useState<RefKind>("character");
  const file = useRef<HTMLInputElement>(null);
  const add = async (f?: File) => {
    if (vault.length >= VAULT_LIMIT) return alert(`The Reference Vault holds up to ${VAULT_LIMIT} items.`);
    const dataUrl = f ? await fileToDataUrl(f, 1024) : undefined;
    const name = f ? f.name.replace(/\.[^.]+$/, "") : `New ${kind}`;
    const description = prompt(`Describe this ${kind} (Claude uses this to keep it consistent):`, name) || name;
    update("vault", (v) => [...v, { id: uid("ref"), kind: f?.type.startsWith("audio") ? "audio" : kind, name, description, dataUrl, tags: [], createdAt: Date.now() }]);
  };
  return (
    <div id="vault" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-14 font-semibold">Reference Vault</p>
        <span className="text-12 text-w50">
          {vault.length}/{VAULT_LIMIT}
        </span>
      </div>
      <div className="flex gap-1 flex-wrap">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`h-6 px-2 rounded-6 text-[11px] font-semibold capitalize ${kind === k ? "bg-w10" : "text-w50"}`}>
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <button onClick={() => file.current?.click()} className="aspect-square rounded-8 border border-dashed border-w10 grid place-items-center text-w50 hover:text-white" title="Upload image or audio">
          <Plus size={16} />
        </button>
        <input ref={file} type="file" accept="image/*,audio/*" hidden onChange={(e) => (add(e.target.files?.[0]), (e.target.value = ""))} />
        {vault
          .filter((r) => r.kind === kind)
          .map((r) => {
            const on = selected.includes(r.id);
            return (
              <button
                key={r.id}
                title={`${r.name}: ${r.description}`}
                onClick={() => onToggle(r.id)}
                className={`relative aspect-square rounded-8 overflow-hidden border-2 ${on ? "border-lime" : "border-transparent"}`}
                style={{ background: r.dataUrl && r.kind !== "audio" ? `center/cover url(${r.dataUrl})` : artGradient(r.name.length * 13 + r.description.length) }}
              >
                <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] font-semibold px-1 truncate">{r.name}</span>
              </button>
            );
          })}
      </div>
      <button onClick={() => add()} className="text-12 text-w50 text-left hover:text-white">
        + Add a text-only {kind}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reference picker: images that guide a generation                    */
/* ------------------------------------------------------------------ */

export interface PickedRef {
  id: string;
  url: string; // data: URL (uploaded) or https: URL (a render)
  name: string;
}

/** Up to `max` reference images: upload from the computer, or pick a render or a Vault item. */
export function RefPicker({ refs, onChange, max = 10, label = "References", drop = "up" }: { refs: PickedRef[]; onChange: (r: PickedRef[]) => void; max?: number; label?: string; drop?: "up" | "down" }) {
  const st = useStudio();
  const [open, setOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const addAll = (more: PickedRef[]) => onChange([...refs, ...more.filter((m) => !refs.some((r) => r.url === m.url))].slice(0, max));
  const upload = async (files: FileList | null) => {
    const list = [...(files || [])].filter((f) => f.type.startsWith("image/")).slice(0, max - refs.length);
    addAll(await Promise.all(list.map(async (f) => ({ id: uid("ref"), url: await fileToDataUrl(f, 1536), name: f.name }))));
    setOpen(false);
  };
  const renders = [...st.images, ...st.shots].filter((s) => s.status === "done" && s.resultUrl && !/\.(mp4|webm|mov)(\?|$)/i.test(s.resultUrl)).slice(0, 24);
  const vault = st.vault.filter((v) => v.dataUrl && v.kind !== "audio");
  return (
    <div className="relative flex items-center gap-1.5">
      <button type="button" aria-label={`Add ${label.toLowerCase()}`} title={`${label} (${refs.length} of ${max})`} disabled={refs.length >= max} onClick={() => setOpen(!open)} className="h-8 min-w-8 px-2 rounded-8 bg-w5 flex items-center gap-1 text-12 font-semibold disabled:opacity-40">
        <Plus size={14} />
        {refs.length > 0 && <span>{refs.length}</span>}
      </button>
      {refs.map((r) => (
        <span key={r.id} className="relative group/ref">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={r.url} alt={r.name} title={r.name} className="w-8 h-8 rounded-6 object-cover border border-w10" />
          <button type="button" aria-label={`Remove ${r.name}`} onClick={() => onChange(refs.filter((x) => x.id !== r.id))} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#1b2024] border border-w20 grid place-items-center text-[9px] opacity-0 group-hover/ref:opacity-100">
            ✕
          </button>
        </span>
      ))}
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => (upload(e.target.files), (e.target.value = ""))} />
      {open && (
        <div className={`absolute ${drop === "up" ? "bottom-full mb-2" : "top-full mt-2"} left-0 z-30 w-[300px] rounded-12 bg-[#1b2024] border border-w10 shadow-2xl p-2 flex flex-col gap-2 text-12`}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">
              {label} · {refs.length} of {max}
            </span>
            <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="text-w50">
              ✕
            </button>
          </div>
          <button type="button" onClick={() => file.current?.click()} className="h-9 rounded-8 bg-lime text-dark font-semibold">
            Upload images from your computer
          </button>
          {renders.length > 0 && (
            <div>
              <p className="text-w50 mb-1">From your renders</p>
              <div className="grid grid-cols-6 gap-1">
                {renders.map((s) => (
                  <button type="button" key={s.id} onClick={() => addAll([{ id: uid("ref"), url: s.resultUrl!, name: s.title }])} className="aspect-square rounded-6 overflow-hidden border border-w10 hover:border-lime">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.resultUrl} alt={s.title} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {vault.length > 0 && (
            <div>
              <p className="text-w50 mb-1">From the Vault</p>
              <div className="grid grid-cols-6 gap-1">
                {vault.map((v) => (
                  <button type="button" key={v.id} onClick={() => addAll([{ id: uid("ref"), url: v.dataUrl!, name: v.name }])} className="aspect-square rounded-6 overflow-hidden border border-w10 hover:border-lime" title={v.name}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.dataUrl} alt={v.name} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[10px] text-w40 leading-4">Only use photos of yourself, or of people who agreed. Flick can only use images made on Flick; Pixmax uses the first reference.</p>
        </div>
      )}
    </div>
  );
}
