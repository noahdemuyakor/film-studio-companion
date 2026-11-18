"use client";
import { useRef, useState } from "react";
import { useStudio, VAULT_LIMIT, modelById } from "@/lib/store";
import type { RefKind, RouteMode, Shot } from "@/lib/types";
import { artGradient, fileToDataUrl, uid } from "@/lib/util";
import { Badge, Select } from "../ui";
import { Copy, Film, Link, Plus, Rerun, Trash } from "../Icons";

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

export function RouteSelector({ mode, lock, onChange, compact }: { mode: RouteMode; lock: string; onChange: (m: RouteMode, lock: string) => void; compact?: boolean }) {
  const platforms = useStudio((s) => s.platforms);
  const modes: { id: RouteMode; label: string }[] = [
    { id: "cheapest", label: compact ? "Cheapest" : "Cheapest credit" },
    { id: "lock", label: compact ? "Lock" : "Feature lock" },
    { id: "preflight", label: compact ? "Pre-flight" : "Pre-flight confirm" },
  ];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-3 gap-1 p-0.5 rounded-8 bg-w5">
        {modes.map((m) => (
          <button key={m.id} onClick={() => onChange(m.id, lock)} className={`h-7 rounded-6 text-[11px] font-semibold ${mode === m.id ? "bg-w10 text-white" : "text-w50"}`}>
            {m.label}
          </button>
        ))}
      </div>
      {mode === "lock" && (
        <div className="rounded-8 bg-w5 px-2 h-8 flex items-center">
          <Select
            label="Locked platform"
            value={lock}
            onChange={(v) => onChange("lock", v)}
            options={[{ id: "", label: "Choose platform…" }, ...platforms.map((p) => ({ id: p.id, label: `${p.name}${p.features[0] ? ` — ${p.features[0]}` : ""}` }))]}
            className="text-12"
          />
        </div>
      )}
    </div>
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
    const dataUrl = f ? await fileToDataUrl(f) : undefined;
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
