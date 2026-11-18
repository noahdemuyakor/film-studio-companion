import SiteHeader from "@/components/SiteHeader";
import ImageStudio from "@/components/studio/ImageStudio";

export const metadata = { title: "Image Studio — Create AI Images from Text & Photo | Film Studio Companion" };

export default function ImagePage() {
  return (
    <div className="min-h-screen bg-ink-2">
      <SiteHeader active="image" promo="app" />
      <main className="mt-2">
        <ImageStudio />
      </main>
    </div>
  );
}
