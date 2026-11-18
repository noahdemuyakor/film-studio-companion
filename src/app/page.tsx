import SiteHeader from "@/components/SiteHeader";
import Footer from "@/components/Footer";
import { Control, CinemaBand, Features, Hero, HowTo } from "@/components/landing/Top";
import { ModelsCloud, ScriptToScreen, Showcase, UseCases } from "@/components/landing/Middle";
import { Blog, Faq, MoreFeatures } from "@/components/landing/Bottom";
import Platforms from "@/components/landing/Platforms";

export const metadata = {
  title: "AI Video Generator — Film Studio Companion",
};

export default function Home() {
  return (
    <>
      <SiteHeader active="explore" />
      <main>
        <Hero />
        <HowTo />
        <Control />
        <Features />
        <CinemaBand />
        <ScriptToScreen />
        <Showcase />
        <ModelsCloud />
        <UseCases />
        <Platforms />
        <Blog />
        <Faq />
        <MoreFeatures />
      </main>
      <Footer />
    </>
  );
}
