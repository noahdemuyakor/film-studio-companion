import SiteHeader from "@/components/SiteHeader";
import AudioStudio from "@/components/studio/AudioStudio";

export const metadata = { title: "Audio Studio — AI Voice Over & Dialogue | Film Studio Companion" };

export default function AudioPage() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="audio" promo="app-md" />
      <main className="mt-2">
        <AudioStudio />
      </main>
    </div>
  );
}
