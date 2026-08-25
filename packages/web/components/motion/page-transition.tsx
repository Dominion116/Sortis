"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-page-transition=""
      initial={reduceMotion ? false : { opacity: 0, y: 16, filter: "blur(5px)" }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function RouteLoading() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="section-shell min-h-[55vh]" role="status" aria-label="Loading page">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="space-y-8"
      >
        <div className="space-y-4">
          <div className="h-3 w-28 overflow-hidden rounded-full bg-muted" />
          <div className="h-11 max-w-xl overflow-hidden rounded-lg bg-muted" />
          <div className="h-4 max-w-2xl overflow-hidden rounded-full bg-muted" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((item) => (
            <div key={item} className="route-loading-card h-56 overflow-hidden rounded-xl border bg-card" />
          ))}
        </div>
      </motion.div>
      <span className="sr-only">Loading the selected page.</span>
    </div>
  );
}
