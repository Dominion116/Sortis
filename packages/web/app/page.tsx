import CircularNavigation from "@/components/navigation";
import FooterPrimary from "@/components/footer-primary";
import { marketingConfig } from "@/config/marketing";
import Hero from "@/components/landing-page/hero";
import LogoCloud from "@/components/landing-page/logo-cloud-svg";
import Problem from "@/components/landing-page/problem";
import FeaturesHover from "@/components/landing-page/features-hover";
import HowItWorks from "@/components/landing-page/how-it-works";
import DrawLive from "@/components/landing-page/draw-live";
import Pools from "@/components/landing-page/pools";
import NoLoss from "@/components/landing-page/no-loss";
import UnderTheHood from "@/components/landing-page/under-the-hood";
import Highlights from "@/components/landing-page/highlights";
import FAQSection from "@/components/landing-page/faq";

export default function IndexPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <CircularNavigation items={marketingConfig.mainNav} />
      <main className="flex-1">
        <div className="mb-5 flex-col gap-10">
          <Hero />
          <LogoCloud />
          <Problem />
          <FeaturesHover />
          <HowItWorks />
          <DrawLive />
          <Pools />
          <NoLoss />
          <UnderTheHood />
          <Highlights />
          <FAQSection />
        </div>
      </main>
      <FooterPrimary />
    </div>
  );
}
