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
        <Hydrate />
        <CookieBanner />
        {children}
      </body>
    </html>
  );
}
