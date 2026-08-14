import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { PoweredBy } from "@/components/sections/powered-by";
import { Problem } from "@/components/sections/problem";
import { HowItWorks } from "@/components/sections/how-it-works";
import { DrawLive } from "@/components/sections/draw-live";
import { NoLoss } from "@/components/sections/no-loss";
import { UnderTheHood } from "@/components/sections/under-the-hood";
import { Faq } from "@/components/sections/faq";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <PoweredBy />
        <Problem />
        <HowItWorks />
        <DrawLive />
        <NoLoss />
        <UnderTheHood />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
