import Hero from "@/components/landing-page/hero";
import LogoCloud from "@/components/landing-page/logo-cloud-svg";
import Problem from "@/components/landing-page/problem";
import FeaturesHover from "@/components/landing-page/features-hover";
import HowItWorks from "@/components/landing-page/how-it-works";
import DrawLive from "@/components/landing-page/draw-live";
import NoLoss from "@/components/landing-page/no-loss";
import Pools from "@/components/landing-page/pools";
import UnderTheHood from "@/components/landing-page/under-the-hood";
import Highlights from "@/components/landing-page/highlights";
import FAQSection from "@/components/landing-page/faq";

export default function IndexPage() {
  return (
    <div className="mb-5 flex-col gap-10">
      <Hero />
      <LogoCloud />
      <Problem />
      <FeaturesHover />
      <HowItWorks />
      <DrawLive />
      <NoLoss />
      <Pools />
      <UnderTheHood />
      <Highlights />
      <FAQSection />
    </div>
  );
}
