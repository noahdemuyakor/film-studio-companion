"use client";
import { useEffect, useState } from "react";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A panel size the viewer can drag, remembered in this browser (falls back to the default if storage is blocked). */
export function usePanelSize(key: string, def: number, min: number, max: number): [number, (n: number) => void] {
  const [size, setSize] = useState(def);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(`fsc-panel:${key}`));
      if (v) setSize(clamp(v, min, max));
    } catch {}
  }, [key, min, max]);
  const set = (n: number) => {
    const v = Math.round(clamp(n, min, max));
    setSize(v);
    try {
      localStorage.setItem(`fsc-panel:${key}`, String(v));
    } catch {}
  };
  return [size, set];
}

/**
 * Drag handle for a panel edge. `dir` is +1 when dragging right/down grows the panel, -1 when it shrinks it.
 * `scale` divides pointer movement (the canvas zoom), so handles inside a zoomed canvas track the cursor.
 * Arrow keys nudge by 16 px; double-click resets to the default.
 */
export function ResizeHandle({
  size,
  setSize,
  def,
  min,
  max,
  dir = 1,
  axis = "x",
  scale = 1,
  label,
  className = "",
}: {
  size: number;
  setSize: (n: number) => void;
  def: number;
  min: number;
  max: number;
  dir?: 1 | -1;
  axis?: "x" | "y";
  scale?: number | (() => number);
  label: string;
  className?: string;
}) {
  const [drag, setDrag] = useState(false);
  const x = axis === "x";
  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={x ? "vertical" : "horizontal"}
      aria-valuenow={size}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label}: drag to resize, double-click to reset`}
      onDoubleClick={() => setSize(def)}
      onKeyDown={(e) => {
        const grow = x ? (e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0) : e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
        if (!grow) return;
        e.preventDefault();
        e.stopPropagation();
        setSize(clamp(size + grow * dir * 16, min, max));
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const p0 = x ? e.clientX : e.clientY;
        const s0 = size;
        const k = typeof scale === "function" ? scale() : scale;
        setDrag(true);
        document.body.style.cursor = x ? "col-resize" : "row-resize";
        document.body.style.userSelect = "none";
        const mv = (ev: PointerEvent) => setSize(clamp(s0 + (dir * ((x ? ev.clientX : ev.clientY) - p0)) / (k || 1), min, max));
        const up = () => {
          setDrag(false);
          document.body.style.cursor = "";
          document.body.style.userSelect = "";
          window.removeEventListener("pointermove", mv);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", mv);
        window.addEventListener("pointerup", up);
      }}
      className={`nodrag nopan group z-30 touch-none outline-none ${x ? "w-2 cursor-col-resize" : "h-2 cursor-row-resize"} ${className}`}
    >
      <span
        className={`block mx-auto my-auto rounded-full transition-colors ${drag ? "bg-lime" : "bg-transparent group-hover:bg-lime/60 group-focus-visible:bg-lime"} ${x ? "w-[3px] h-full" : "h-[3px] w-full"}`}
      />
    </div>
  );
}
