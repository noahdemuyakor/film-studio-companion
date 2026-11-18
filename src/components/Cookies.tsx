"use client";
import NextLink from "next/link";
import { useEffect, useState } from "react";
import { useStudio } from "@/lib/store";
import { ChevronR, Close, Sliders } from "./Icons";

const CATS = [
  {
    id: "essential",
    title: "Essential",
    body: "Needed for the studio to run: keeping you signed in, protecting your session and remembering the choices you make in this panel. These stay on.",
    off: "",
    locked: true,
  },
  {
    id: "ads",
    title: "Advertising",
    body: "Help us show offers for Film Studio Companion that match your interests on other sites.",
    off: "Without them, offers you see elsewhere will be generic.",
  },
  {
    id: "analytics",
    title: "Analytics & Customization",
    body: "Tell us which tools people open, which flows break and how visitors found us, so we can fix problems and decide what to build next. Switching them off never changes how the studio works for you.",
    off: "Without them, we can't learn from how the studio is used.",
  },
  {
    id: "perf",
    title: "Performance & Functionality",
    body: "Remember layout preferences such as panel sizes and timeline zoom, and keep pages loading quickly.",
    off: "Without them, some preferences reset between visits.",
  },
];

function Toggle({ on, onClick, disabled }: { on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${on ? "bg-lime" : "bg-[#46515a]"}`}
    >
      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? "left-[14px] bg-white/90" : "left-0.5"}`} />
    </button>
  );
}

const TOGGLE = "cookie-prefs-toggle";

function closeToggle() {
  if (window.location.hash === `#${TOGGLE}`) window.location.hash = "_";
}

/** With `css` the dialog opens through a checkbox, so it works even before scripts finish loading. */
export function CookiePreferences({ open, onClose, css }: { open: boolean; onClose: () => void; css?: boolean }) {
  const set = useStudio((s) => s.set);
  const [on, setOn] = useState<Record<string, boolean>>({ essential: true, ads: false, analytics: false, perf: false });
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open && !css) return null;
  const close = () => (css ? closeToggle() : onClose());
  return (
    <div id={css ? TOGGLE : undefined} className={`fixed inset-0 z-[60] bg-black/60 justify-center items-start p-3 md:pt-[84px] ${css ? "hidden target:flex" : "flex"}`} onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Your Cookie Preferences"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] max-h-[calc(100vh-24px)] md:max-h-[732px] bg-panel rounded-16 border border-w5 flex flex-col"
      >
        <div className="flex items-start justify-between px-4 pt-4">
          <h2 className="text-18 font-semibold">Your Cookie Preferences</h2>
          {css ? (
            <a href="#_" aria-label="Close" className="w-6 h-6 grid place-items-center rounded-full hover:bg-w10">
              <Close size={18} />
            </a>
          ) : (
            <button aria-label="Close" onClick={onClose} className="w-6 h-6 grid place-items-center rounded-full hover:bg-w10">
              <Close size={18} />
            </button>
          )}
        </div>
        <div className="thin-scroll overflow-y-auto px-4 pb-2 flex-1">
          <p className="text-14 text-white/80 leading-5 mt-1">
            We use cookies to run Film Studio Companion, keep it secure, understand how it&apos;s used and see which campaigns bring people here. Open a
            category to see what it covers, then choose what you allow. Essential cookies are always on because the studio can&apos;t work without them.
            You can come back and change this at any time. Full details are in our{" "}
            <NextLink href="/cookie-notice/" className="underline text-white">
              Cookie Notice
            </NextLink>
          </p>
          <div className="flex gap-2 mt-4 mb-4">
            <button onClick={() => setOn({ essential: true, ads: true, analytics: true, perf: true })} className="h-[22px] px-3 rounded-[4px] bg-w10 text-12 font-semibold">
              Select All
            </button>
            <button onClick={() => setOn({ essential: true, ads: false, analytics: false, perf: false })} className="h-[22px] px-3 rounded-[4px] bg-w10 text-12 font-semibold">
              Unselect All
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {CATS.map((c) => (
              <section key={c.id} className="rounded-12 bg-w5 p-4">
                <div className="flex items-center gap-3">
                  <Toggle on={!!on[c.id]} disabled={c.locked} onClick={() => setOn({ ...on, [c.id]: !on[c.id] })} />
                  <h3 className="text-16 font-semibold">{c.title}</h3>
                  <span className="ml-auto flex items-center gap-1 h-6 px-2.5 rounded-6 bg-panel-2 text-12 font-semibold">
                    Learn more <ChevronR size={12} />
                  </span>
                </div>
                <p className="mt-3 text-14 text-white/60 leading-5">{c.body}</p>
                {c.off && !on[c.id] && <p className="mt-3 text-14 text-w30">{c.off}</p>}
              </section>
            ))}
          </div>
        </div>
        <div className="flex justify-end p-4">
          <button
            onClick={() => {
              set({ cookieChoice: "custom" });
              close();
            }}
            className="h-10 px-[18px] rounded-8 bg-lime text-dark-2 text-14 font-semibold"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CookieBanner() {
  const choice = useStudio((s) => s.cookieChoice);
  const set = useStudio((s) => s.set);
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState(false);
  useEffect(() => {
    const unsub = useStudio.persist.onFinishHydration(() => setReady(true));
    if (useStudio.persist.hasHydrated()) setReady(true);
    return unsub;
  }, []);
  return (
    <>
      {(!ready || !choice) && (
        <div
          role="dialog"
          aria-label="Cookie Notice"
          className="fixed z-50 left-3 right-3 bottom-3 md:left-auto md:right-4 md:bottom-4 md:w-[400px] bg-pop rounded-16 p-4 pt-4 shadow-[0_20px_25px_-5px_rgba(0,0,0,.1),0_8px_10px_-6px_rgba(0,0,0,.1)]"
        >
          <NextLink href="/cookie-notice/" className="block text-18 font-semibold px-1 leading-[31px]">Cookie Notice</NextLink>
          <p className="mt-1 text-14 leading-5 text-w60">
            We use cookies to run Film Studio and understand how it&apos;s used. You can turn analytics off in Cookie Preferences. We also use
            advertising tools to measure results and support our ads, subject to the choices available where you live. See our{" "}
            <NextLink href="/cookie-notice/" className="text-white">
              Cookie Notice
            </NextLink>
            .
          </p>
          <div className="grid grid-cols-2 gap-2 mt-5">
            <button onClick={() => set({ cookieChoice: "accepted" })} className="h-10 rounded-8 bg-lime text-dark-2 text-14 font-semibold">
              Accept All Cookies
            </button>
            <button onClick={() => set({ cookieChoice: "dismissed" })} className="h-10 rounded-8 bg-w10 text-14 font-semibold">
              Dismiss
            </button>
          </div>
          <button type="button" aria-haspopup="dialog" onClick={() => setPrefs(true)} className="mt-2 w-full h-10 rounded-8 border border-w10 text-14 font-semibold flex items-center justify-center gap-2">
            <Sliders size={20} /> Cookie Preferences
          </button>
        </div>
      )}
      <CookiePreferences open={prefs} onClose={() => setPrefs(false)} />
    </>
  );
}
