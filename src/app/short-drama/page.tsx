import SiteHeader from "@/components/SiteHeader";
import DramaStudio from "@/components/studio/DramaStudio";

export const metadata = { title: "Drama Studio — Script to Series | Film Studio Companion" };

export default function Page() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="drama" />
      <main>
        <DramaStudio />
      </main>
    </div>
  );
}
