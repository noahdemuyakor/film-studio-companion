import SiteHeader from "@/components/SiteHeader";
import ModelHub from "@/components/studio/ModelHub";

export const metadata = { title: "Model Hub — Bring Your Own Model | Film Studio Companion" };

export default function Page() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="models" />
      <main>
        <ModelHub />
      </main>
    </div>
  );
}
