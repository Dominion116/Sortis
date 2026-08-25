"use client";

import { features } from "@/config/features";
import { motion } from "framer-motion";
import React from "react";
import { ScrollStagger, StaggerItem } from "@/components/motion/scroll-reveal";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export default function FeaturesHover() {
  const reduceMotion = useReducedMotion();
  return (
    <section
      id="features"
      className="section-shell space-y-10 rounded-3xl bg-muted/70 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Features
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          The pool, yield, and draw all run over encrypted balances.
        </p>
      </div>
      <ScrollStagger className="mx-auto grid w-full gap-6 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
        {features.map((feature) => (
          <StaggerItem key={feature.title}>
          <motion.div
            whileHover={reduceMotion ? undefined : { y: -6 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="motion-card relative h-full overflow-hidden rounded-xl border bg-card p-5 sm:p-6"
          >
            <a href={feature.link}>
              <svg
                viewBox="0 0 24 24"
                className="mb-4 h-12 w-12 fill-current"
                fillRule={
                  feature.fillRule as React.SVGAttributes<SVGSVGElement>["fillRule"]
                }
              >
                <path d={feature.svgPath} />
              </svg>
              <div className="mb-2 text-lg font-medium text-foreground">
                {feature.title}
              </div>
              <div className="text-sm font-normal text-muted-foreground">
                {feature.description}
              </div>
            </a>
          </motion.div>
          </StaggerItem>
        ))}
      </ScrollStagger>
    </section>
  );
}
