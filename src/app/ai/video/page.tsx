import SiteHeader from "@/components/SiteHeader";
import CinemaStudio from "@/components/studio/CinemaStudio";

export const metadata = { title: "Cinema Studio — Create AI Videos from Text & Image | Film Studio Companion" };

export default function VideoPage() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="video" promo="app" />
      <main className="max-w-wide mx-auto mt-2">
        <CinemaStudio />
      </main>
    </div>
  );
}
