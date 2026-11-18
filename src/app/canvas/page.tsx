import SiteHeader from "@/components/SiteHeader";
import Canvas from "@/components/studio/Canvas";

export const metadata = { title: "Infinite Canvas | Film Studio Companion" };

export default function Page() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="canvas" />
      <main>
        <Canvas />
      </main>
    </div>
  );
}
