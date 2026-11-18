import NextLink from "next/link";
import { Logo } from "./Icons";

const COLS: { title: string; links: [string, string][] }[][] = [
  [
    { title: "Create", links: [["Video", "/ai/video/"], ["Image", "/ai/image/"], ["Audio & voices", "/audio/"], ["Node canvas", "/canvas/"], ["Short drama", "/short-drama/"], ["Timeline editor", "/short-drama/#timeline"], ["Reference vault", "/ai/video/#vault"], ["Compare models", "/canvas/"], ["Frame locking", "/ai/video/"], ["Clip extension", "/ai/video/"], ["Optical stack", "/ai/video/"], ["Motion control", "/ai/video/"], ["Director's panel", "/ai/video/"], ["Cast registry", "/short-drama/"], ["Subtitles", "/short-drama/#timeline"], ["Export", "/short-drama/#timeline"]] },
  ],
  [
    { title: "Video Models", links: [["Seedance 2.5", "/models/"], ["Kling 3.0", "/models/"], ["Kling 4.0", "/models/"], ["Veo 3.1", "/models/"], ["Omni Flash", "/models/"], ["Wan 2.7", "/models/"], ["MiniMax H3", "/models/"], ["Add your own", "/models/"]] },
    { title: "Image Models", links: [["Nano Banana 2.1", "/models/"], ["Nano Banana Pro", "/models/"], ["Flux.1 Pro / Dev", "/models/"], ["Ideogram", "/models/"], ["SDXL", "/models/"]] },
  ],
  [
    { title: "Studios", links: [["Cinema Studio", "/ai/video/"], ["Drama Studio", "/short-drama/"], ["Canvas", "/canvas/"], ["Audio Studio", "/audio/"], ["Image Studio", "/ai/image/"], ["Model Hub", "/models/"], ["Power Engine", "/settings/"]] },
    { title: "Engine", links: [["Showrunner", "/short-drama/"], ["Prompt compiler", "/ai/video/"], ["Continuity guardian", "/ai/video/"]] },
  ],
  [
    { title: "Platform", links: [["Model registry", "/models/"], ["Adapters", "/models/"], ["Providers", "/models/"], ["Cost estimator", "/models/"], ["Draft vs final", "/models/"], ["Local webhooks", "/models/"]] },
    { title: "Resources", links: [["Guides", "/"], ["FAQ", "/#faq"]] },
  ],
  [
    { title: "Company", links: [["About", "/"], ["Careers", "/"], ["Press", "/"], ["Contact", "/"], ["Cookie Notice", "/cookie-notice/"], ["Terms", "/"], ["Privacy", "/"]] },
    { title: "Community", links: [["Showcase", "/"], ["Discord", "/"], ["Newsletter", "/"]] },
  ],
];

export function BottomBar() {
  return (
    <footer className="bg-ink-2 text-soft">
      <nav className="flex flex-col md:flex-row md:items-center gap-5 p-6 text-14" aria-label="Legal">
        <p className="text-mute">© 2026 Film Studio Companion. All rights reserved.</p>
        <ul className="md:ml-auto flex flex-wrap items-center gap-x-6 gap-y-3 font-medium">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full" style={{ background: "linear-gradient(#b22234 0 20%,#fff 20% 40%,#b22234 40% 60%,#fff 60% 80%,#3c3b6e 80%)" }} />
            English
          </li>
          <li><NextLink href="/">Help center</NextLink></li>
          <li><NextLink href="/cookie-notice/">Cookie Notice</NextLink></li>
          <li><NextLink href="/cookie-notice/#settings">Cookie Settings</NextLink></li>
          <li><NextLink href="/">Terms</NextLink></li>
          <li><NextLink href="/">Privacy</NextLink></li>
          <li><NextLink href="/">Report a vulnerability</NextLink></li>
        </ul>
      </nav>
    </footer>
  );
}

export default function Footer() {
  return (
    <>
      <footer className="bg-lime text-dark-2">
        <div className="flex flex-col lg:flex-row gap-10 px-4 py-9">
          <div className="lg:w-[384px] shrink-0 lg:pr-10 flex flex-col">
            <div className="flex items-center gap-2">
              <Logo size={36} />
              <span className="text-20 font-bold">Film Studio Companion</span>
            </div>
            <h2 className="font-display font-bold uppercase text-40 md:text-48 leading-[1] mt-8">AI-native creative suite</h2>
            <p className="mt-4 text-16 font-medium leading-6 text-dark-2/70">
              Write, block, shoot and cut AI films in one place. Claude runs the room; you bring any model you like.
            </p>
            <NextLink href="/ai/video/" className="mt-6 self-start h-12 px-5 rounded-12 bg-dark-2 text-white text-16 font-semibold flex items-center">
              Start creating
            </NextLink>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-10 flex-1">
            {COLS.map((group, i) => (
              <div key={i} className="flex flex-col gap-9">
                {group.map((c) => (
                  <section key={c.title}>
                    <h3 className="text-14 font-semibold text-dark-2/50 mb-3">{c.title}</h3>
                    <ul className="flex flex-col gap-3">
                      {c.links.map(([l, h]) => (
                        <li key={l}>
                          <NextLink href={h} className="text-14 font-medium hover:underline">
                            {l}
                          </NextLink>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ))}
          </div>
        </div>
      </footer>
      <BottomBar />
    </>
  );
}
