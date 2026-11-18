import SiteHeader from "@/components/SiteHeader";
import { BottomBar } from "@/components/Footer";
import CookieDoc from "@/components/CookieDoc";

export const metadata = { title: "Cookie Notice • Film Studio Companion" };

export default function CookieNoticePage() {
  return (
    <div className="bg-ink min-h-screen">
      <SiteHeader promo="slim" mobile="doc" />
      <main className="max-w-doc mx-auto">
        <div className="px-4 pt-[72px] pb-[60px]">
          <CookieDoc />
        </div>
      </main>
      <BottomBar />
    </div>
  );
}
