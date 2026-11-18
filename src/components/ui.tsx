"use client";
import { useEffect, type ReactNode } from "react";
import { Close } from "./Icons";

export function Box({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-12 bg-w5 ${className}`}>{children}</div>;
}

export function Label({ children }: { children: ReactNode }) {
  return <p className="text-12 text-w50 leading-4">{children}</p>;
}

export function Select({ value, onChange, options, className = "", label }: { value: string; onChange: (v: string) => void; options: (string | { id: string; label: string })[]; className?: string; label?: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-transparent text-14 font-semibold outline-none w-full appearance-none cursor-pointer ${className}`}
    >
      {options.map((o) => {
        const id = typeof o === "string" ? o : o.id;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={id} value={id} className="bg-panel text-white">
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Slider({ value, min, max, step = 1, onChange, label, display }: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; label: string; display?: string }) {
  return (
    <label className="block">
      <span className="flex justify-between text-12 text-w50 mb-1.5">
        <span>{label}</span>
        <span className="text-white font-semibold">{display ?? value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#8db600]" />
    </label>
  );
}

export function Chip({ active, children, onClick, title }: { active?: boolean; children: ReactNode; onClick?: () => void; title?: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`h-8 px-2.5 rounded-8 text-12 font-semibold flex items-center gap-1.5 transition-colors ${active ? "bg-lime text-dark-2" : "bg-w5 hover:bg-w10 text-white"}`}
    >
      {children}
    </button>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-1">
      <p className="text-14 font-semibold">{children}</p>
      {right}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 720 }: { open: boolean; onClose: () => void; title: string; children: ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-start justify-center p-3 md:pt-16 overflow-y-auto" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="w-full bg-panel rounded-16 border border-w10 shadow-2xl" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-w5">
          <h2 className="text-18 font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="w-7 h-7 rounded-full grid place-items-center hover:bg-w10">
            <Close size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "lime" | "pink" }) {
  const c = tone === "lime" ? "bg-[#8db6003d] text-lime" : tone === "pink" ? "bg-[#ff005b33] text-[#ff5c9a]" : "bg-w10 text-w60";
  return <span className={`text-10 font-semibold rounded-6 px-1.5 py-0.5 ${c}`}>{children}</span>;
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full h-9 rounded-8 bg-w5 border border-w5 px-3 text-14 outline-none focus:border-w30 placeholder:text-w30 ${props.className || ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-8 bg-w5 border border-w5 p-3 text-14 outline-none focus:border-w30 placeholder:text-w30 resize-y ${props.className || ""}`} />;
}
