"use client";

import Link from "next/link";
import { siteConfig } from "@/config/site";
import { MOCK } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Particles from "@/components/magicui/particles";
import Ripple from "@/components/magicui/ripple";
import AnimatedGradientText from "@/components/magicui/animated-shiny-text";
import { ArrowRightIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { Countdown } from "@/components/countdown";
import { Stat } from "@/components/stat";
import { useHasMounted, useReducedMotion } from "@/hooks/use-reduced-motion";

export default function HeroSection() {
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const reduceMotion = useReducedMotion();

  const particleColor = resolvedTheme === "dark" ? "#FFFFFF" : "#000000";

  return (
    <section className="relative w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        {mounted && !reduceMotion ? (
          <>
            <Particles
              className="absolute inset-0"
              quantity={300}
              ease={80}
              color={particleColor}
              refresh
            />
            <Ripple />
          </>
        ) : null}
      </div>
      <div className="container mx-auto px-4 py-12 md:py-16 lg:py-32">
        <div className="relative z-10 mx-auto flex max-w-[64rem] flex-col items-center gap-4 text-center">
          <Link href={siteConfig.links.zama} target="_blank" rel="noreferrer" className="w-fit">
            <div
              className={cn(
                "group rounded-full border border-black/5 bg-neutral-100 text-base text-foreground transition-all ease-in hover:cursor-pointer hover:bg-neutral-200 dark:border-white/5 dark:bg-neutral-900 dark:hover:bg-neutral-800",
              )}
            >
              <AnimatedGradientText className="inline-flex items-center justify-center px-4 py-2 transition ease-out hover:text-neutral-600 hover:duration-300 hover:dark:text-neutral-400">
                <span
                  className={cn(
                    "inline animate-gradient bg-gradient-to-r from-[#b76a24] via-[#6a24b7] to-[#b76a24] bg-[length:var(--bg-size)_100%] bg-clip-text text-transparent [--bg-size:300%]",
                  )}
                >
                  Zama Developer Program, Mainnet Season 4
                </span>
                <ArrowRightIcon className="ml-2 size-4 transition-transform duration-300 ease-in-out group-hover:translate-x-0.5" />
              </AnimatedGradientText>
            </div>
          </Link>

          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            Everyone saves together, one person wins the yield, and nobody can
            see who holds what.
          </h1>
          <div className="max-w-[42rem] rounded-full p-2 text-primary tracking-tight sm:text-xl sm:leading-8">
            Sortis is a no-loss prize savings pool built on the Zama Protocol.
            You deposit a confidential token and your principal remains yours to
            withdraw at any moment, while the interest the pool earns is pooled
            into a single prize that one saver wins each round. Every balance
            stays encrypted from the moment you deposit, including throughout
            the draw itself.
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/#how-it-works"
              className={cn(
                buttonVariants({ size: "xl" }),
                "text-bold rounded-full border-2 border-primary text-white dark:border-white dark:text-zinc-900",
              )}
            >
              See how it works
            </Link>
            <Link
              href={siteConfig.links.github}
              target="_blank"
              rel="noreferrer"
              className={cn(
                buttonVariants({ variant: "outline", size: "xl" }),
                "rounded-full border-2 border-primary text-semibold dark:border-white",
              )}
            >
              GitHub <GitHubLogoIcon className="ml-2" />
            </Link>
          </div>
          <div className="mt-6 grid w-full max-w-4xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
            <div className="rounded-lg border bg-background/80 p-4 backdrop-blur-sm dark:bg-zinc-950/80">
              <Stat
                label="Total pooled"
                value={MOCK.totalPooled}
                sublabel="illustrative"
              />
            </div>
            <div className="rounded-lg border bg-background/80 p-4 backdrop-blur-sm dark:bg-zinc-950/80">
              <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                Next draw
              </span>
              <Countdown
                offsetMs={MOCK.nextDrawOffsetMs}
                size="sm"
                className="mt-1.5"
              />
            </div>
            <div className="rounded-lg border bg-background/80 p-4 backdrop-blur-sm dark:bg-zinc-950/80">
              <Stat
                label="Participants"
                value={MOCK.participantCount}
                sublabel="this round"
              />
            </div>
            <div className="rounded-lg border bg-background/80 p-4 backdrop-blur-sm dark:bg-zinc-950/80">
              <CiphertextReveal
                label="Example balance"
                value={MOCK.myBalance}
                size="sm"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
