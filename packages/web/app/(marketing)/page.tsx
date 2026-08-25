import Hero from "@/components/landing-page/hero";
import LogoCloud from "@/components/landing-page/logo-cloud-svg";
import Problem from "@/components/landing-page/problem";
import FeaturesHover from "@/components/landing-page/features-hover";
import HowItWorks from "@/components/landing-page/how-it-works";
import DrawLive from "@/components/landing-page/draw-live";
import NoLoss from "@/components/landing-page/no-loss";
import Pools from "@/components/landing-page/pools";
import UnderTheHood from "@/components/landing-page/under-the-hood";
import FAQSection from "@/components/landing-page/faq";
import { ScrollReveal } from "@/components/motion/scroll-reveal";

export default function IndexPage() {
  return (
    <div className="landing-page">
      <Hero />
      <ScrollReveal><LogoCloud /></ScrollReveal>
      <ScrollReveal delay={0.03}><Problem /></ScrollReveal>
      <ScrollReveal delay={0.03}><FeaturesHover /></ScrollReveal>
      <ScrollReveal delay={0.03}><HowItWorks /></ScrollReveal>
      <ScrollReveal delay={0.03}><DrawLive /></ScrollReveal>
      <ScrollReveal delay={0.03}><NoLoss /></ScrollReveal>
      <ScrollReveal delay={0.03}><Pools /></ScrollReveal>
      <ScrollReveal delay={0.03}><UnderTheHood /></ScrollReveal>
      <ScrollReveal delay={0.03}><FAQSection /></ScrollReveal>
    </div>
  );
}
