import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
});

export const Plus = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 5v14M5 12h14" /></svg>);
export const Minus = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12h14" /></svg>);
export const Arrow = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const ChevronR = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 6l6 6-6 6" /></svg>);
export const ChevronL = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M15 6l-6 6 6 6" /></svg>);
export const ChevronD = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 9l6 6 6-6" /></svg>);
export const Close = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const Search = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
export const Clock = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>);
export const Expand = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>);
export const Speaker = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /></svg>);
export const Mute = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M22 9l-6 6M16 9l6 6" /></svg>);
export const Bars = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 19V9M10 19V5M15 19v-8M20 19V7" /></svg>);
export const Spark = ({ size, ...p }: P) => (<svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l2.2 6.8L21 11l-6.8 2.2L12 20l-2.2-6.8L3 11l6.8-2.2z" /></svg>);
export const Image = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 17l-5-5-9 8" /></svg>);
export const Film = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>);
export const Mic = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>);
export const Music = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></svg>);
export const Wave = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12h2M7 8v8M11 5v14M15 8v8M19 10v4M21 12h0" /></svg>);
export const Book = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M2 5a2 2 0 012-2h6v18H4a2 2 0 01-2-2zM22 5a2 2 0 00-2-2h-6v18h6a2 2 0 002-2z" /></svg>);
export const Folder = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>);
export const Sliders = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 3v18M12 3v18M19 3v18" /><rect x="3" y="14" width="4" height="3" rx="1" fill="currentColor" /><rect x="10" y="6" width="4" height="3" rx="1" fill="currentColor" /><rect x="17" y="12" width="4" height="3" rx="1" fill="currentColor" /></svg>);
export const Translate = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 5h8M8 3v2M6 5c0 4 3 7 6 8M10 5c0 3-3 7-6 8M13 21l4-9 4 9M14.5 18h5" /></svg>);
export const Building = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="4" y="3" width="10" height="18" /><path d="M14 9h6v12h-6M7 7h4M7 11h4M7 15h4" /></svg>);
export const Crown = ({ size, ...p }: P) => (<svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M3 7l5 4 4-7 4 7 5-4-2 12H5z" /></svg>);
export const Check = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M5 12l5 5 9-10" /></svg>);
export const Cross = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M7 7l10 10M17 7L7 17" /></svg>);
export const Rerun = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" /><path d="M3 3v5h5" /></svg>);
export const Copy = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" /></svg>);
export const Trash = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>);
export const Lock = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>);
export const Unlock = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 017.5-2" /></svg>);
export const Play = ({ size, ...p }: P) => (<svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M7 4l13 8-13 8z" /></svg>);
export const Pause = ({ size, ...p }: P) => (<svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="currentColor" {...p}><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>);
export const Grid = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></svg>);
export const Gift = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="3" y="8" width="18" height="4" /><path d="M5 12v9h14v-9M12 8v13M12 8S10 3 7.5 4.5 9 8 12 8zM12 8s2-5 4.5-3.5S15 8 12 8z" /></svg>);
export const Brain = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 1V5a2 2 0 00-3-1zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-6 1" /></svg>);
export const Link = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M10 14a4 4 0 006 0l3-3a4 4 0 00-6-6l-1 1M14 10a4 4 0 00-6 0l-3 3a4 4 0 006 6l1-1" /></svg>);
export const Camera = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><rect x="2" y="7" width="15" height="12" rx="2" /><path d="M17 11l5-3v10l-5-3M6 4h5" /></svg>);
export const Aperture = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M14.3 3.3L9 12M20.4 8.5H10M18.4 18.3L13 9M9.7 20.7L15 12M3.6 15.5H14M5.6 5.7L11 15" /></svg>);
export const At = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="4" /><path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-4 8" /></svg>);
export const Diamond = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M6 3h12l4 6-10 12L2 9z" /></svg>);
export const Download = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><path d="M12 4v12M6 10l6 6 6-6M4 20h16" /></svg>);
export const Settings = ({ size, ...p }: P) => (<svg {...base(size)} {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>);
export const Tag = ({ size, ...p }: P) => (<svg width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M3 12V4a1 1 0 011-1h8l9 9-9 9z" /><circle cx="7.5" cy="7.5" r="1.5" fill="#8db600" /></svg>);

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#fff" />
      <path d="M6 16.5c2-5 4-8 6-8s1 4 3 4 2-3 3-5" stroke="#1b2024" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="7" cy="7.5" r="1.6" fill="#1b2024" />
    </svg>
  );
}
