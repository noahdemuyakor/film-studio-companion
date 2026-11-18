export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;

export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Deterministic cinematic gradient used as placeholder art and preview renders. */
export function artGradient(seed: number) {
  const r = (n: number) => {
    const x = Math.sin(seed * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const h1 = Math.floor(r(1) * 360);
  const h2 = (h1 + 30 + Math.floor(r(2) * 120)) % 360;
  const h3 = (h1 + 180 + Math.floor(r(3) * 60)) % 360;
  const x1 = Math.floor(r(4) * 100);
  const y1 = Math.floor(r(5) * 70);
  const x2 = Math.floor(r(6) * 100);
  return [
    `radial-gradient(ellipse at ${x1}% ${y1}%, hsl(${h1} 70% 62% / .85), transparent 55%)`,
    `radial-gradient(ellipse at ${x2}% 85%, hsl(${h2} 55% 38% / .9), transparent 60%)`,
    `linear-gradient(160deg, hsl(${h3} 35% 16%), hsl(${h1} 30% 8%))`,
  ].join(",");
}

export function downloadText(name: string, text: string, type = "application/json") {
  const blob = new Blob([text], { type });
  downloadBlob(name, blob);
}

export function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function fileToDataUrl(file: File, maxSide = 384): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(fr.error);
    fr.onload = () => {
      const src = String(fr.result);
      if (!file.type.startsWith("image/")) return resolve(src);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, maxSide / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s);
        c.height = Math.round(img.height * s);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    fr.readAsDataURL(file);
  });
}

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), obj);
}

export function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  parts.forEach((p, idx) => {
    if (idx === parts.length - 1) {
      cur[p] = value;
      return;
    }
    const nextIsIndex = /^\d+$/.test(parts[idx + 1]);
    if (cur[p] == null) cur[p] = nextIsIndex ? [] : {};
    cur = cur[p] as Record<string, unknown>;
  });
}

export function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 10);
  return `${m}:${String(sec).padStart(2, "0")}.${f}`;
}
