import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "@xyflow/react/dist/style.css";
import "./globals.css";
import Hydrate from "@/components/Hydrate";
import CookieBanner from "@/components/Cookies";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], weight: ["500", "700"], variable: "--font-grotesk", display: "swap" });

export const metadata: Metadata = {
  title: "Film Studio Companion — AI Video, Cinema & Drama Studio",
  description: "One workspace for AI filmmaking: node canvas, cinema optical stack, short-drama breakdowns, timeline and a bring-your-own-model hub, orchestrated by Claude.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1b2024" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        {/* After a redeploy, a cached page can ask for script files that no longer exist: reload once to get the new build. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){function f(m){if(!/ChunkLoadError|Loading chunk|Failed to load chunk|Failed to fetch dynamically imported module/i.test(m||''))return;try{var k='fsc-chunk-reload',t=+sessionStorage.getItem(k)||0;if(Date.now()-t<30000)return;sessionStorage.setItem(k,String(Date.now()))}catch(e){}location.reload()}addEventListener('error',function(e){f((e.error&&(e.error.name+' '+e.error.message))||e.message)});addEventListener('unhandledrejection',function(e){var r=e.reason;f(r&&(r.name+' '+r.message))})})();`,
          }}
        />
        <Hydrate />
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
