"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";

/** Shared easing so the route entrance and the panel content fade agree. */
const EASE = [0.22, 1, 0.36, 1] as const;

export function PageTransition({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      data-page-transition=""
      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Fades a resolved subtree in where a skeleton just was.
 *
 * `loading.tsx` only covers the route-streaming wait. The real wait on the app
 * screens is an RPC read inside a client component, so without this the
 * skeleton is replaced by content in a single frame and reads as a pop. Keying
 * the caller's element on its loading state is what makes this animate.
 */
export function ContentFade({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Route-level skeleton.
 *
 * The app variant deliberately adds no container: `app/(app)/layout.tsx` already
 * wraps `children` in `.app-shell`, and nesting a second one would double the
 * gutter. `variant="marketing"` supplies its own `.section-shell`, because the
 * marketing layout does not wrap content in a container.
 */
export function RouteLoading({
  variant = "app",
}: {
  variant?: "app" | "marketing";
}) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        "min-h-[55vh]",
        variant === "app" ? "" : "section-shell space-y-8",
      )}
      role="status"
      aria-label="Loading page"
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35, ease: EASE }}
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
