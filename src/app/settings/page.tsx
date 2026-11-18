import SiteHeader from "@/components/SiteHeader";
import SettingsHub from "@/components/studio/SettingsHub";

export const metadata = { title: "Settings — Power Engine, Platforms & Wallets | Film Studio Companion" };

export default function Page() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="engine" />
      <main>
        <SettingsHub />
      </main>
    </div>
  );
}
