"use client";

import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import Particles from "@/components/magicui/particles";
import Ripple from "@/components/magicui/ripple";
import AnimatedGradientText from "@/components/magicui/animated-shiny-text";
import { ArrowRightIcon, GitHubLogoIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { useHasMounted, useReducedMotion } from "@/hooks/use-reduced-motion";

export default function HeroSection() {
  const { resolvedTheme } = useTheme();
  const mounted = useHasMounted();
  const reduceMotion = useReducedMotion();

  const particleColor = resolvedTheme === "dark" ? "#FFFFFF" : "#000000";

  return (
    <section className="relative flex min-h-[82svh] w-full items-center overflow-hidden sm:min-h-[78svh] lg:min-h-[78vh]">
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
      <div className="container mx-auto px-4 py-12 md:py-16 lg:py-24">
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
          <div className="max-w-[42rem] p-2 text-base leading-7 text-muted-foreground sm:text-lg">
            Confidential prize savings on Zama. Your principal stays yours; the
            pool&apos;s yield funds one private winner each round.
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/#how-it-works"
              className={cn(
                buttonVariants({ size: "xl" }),
                "rounded-full border-2 border-primary text-white dark:border-white dark:text-zinc-900",
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
                "rounded-full border-2 border-primary font-medium dark:border-white",
              )}
            >
              GitHub <GitHubLogoIcon className="ml-2" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
