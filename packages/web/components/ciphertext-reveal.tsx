"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";

const SCRAMBLE_CHARS = "0123456789ABCDEF";

function randomChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}

function maskedString(length: number) {
  return Array.from({ length }, randomChar).join("");
}

function hashString(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Mulberry32: small, fast, deterministic PRNG. All ops are 32-bit safe via Math.imul. */
function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A masked string derived only from `value`: same output on the server and
 * during the client's first (hydration) render, unlike `maskedString`, which
 * calls `Math.random()` and would render differently on each side. Used only
 * for the initial paint; the idle shimmer switches to real randomness once
 * mounted, when there's no hydration pass left to mismatch.
 */
function deterministicMask(value: string) {
  const rand = mulberry32(hashString(value) || 1);
  let out = "";
  for (let i = 0; i < value.length; i++) {
    out += SCRAMBLE_CHARS[Math.floor(rand() * SCRAMBLE_CHARS.length)];
  }
  return out;
}

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

const SIZE_CLASSES = {
  sm: "text-sm sm:text-base",
  md: "text-2xl sm:text-3xl",
  lg: "text-5xl sm:text-6xl",
} as const;

interface CiphertextRevealProps {
  /** The real value to reveal, already formatted for display. */
  value: string;
  label?: string;
  className?: string;
  size?: keyof typeof SIZE_CLASSES;
  /** Static masked display with no reveal control, used for "someone else's" balance. */
  interactive?: boolean;
}

export function CiphertextReveal({
  value,
  label,
  className,
  size = "md",
  interactive = true,
}: CiphertextRevealProps) {
  const [revealed, setRevealed] = useState(false);
  const [display, setDisplay] = useState(() => deterministicMask(value));
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (revealed) return;
    const id = setInterval(() => setDisplay(maskedString(value.length)), 2200);
    return () => clearInterval(id);
  }, [revealed, value.length]);

  useEffect(() => {
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  function reveal() {
    if (revealed) {
      setRevealed(false);
      return;
    }
    setRevealed(true);

    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const duration = 750;
    const start = performance.now();
    const len = value.length;

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const settled = Math.floor(progress * len);
      let next = "";
      for (let i = 0; i < len; i++) {
        if (i < settled || value[i] === " ") next += value[i];
        else next += randomChar();
      }
      setDisplay(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className={cn("inline-flex items-end gap-3", className)}>
      <div className="flex flex-col gap-1">
        {label ? (
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            "tabular font-mono leading-none tracking-[-0.01em]",
            SIZE_CLASSES[size],
            revealed ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {display}
        </span>
        <span className="sr-only" role="status">
          {revealed
            ? `Decrypted value: ${value}`
            : "Value hidden. Only the owner can decrypt it."}
        </span>
      </div>
      {interactive ? (
        <button
          type="button"
          onClick={reveal}
          aria-pressed={revealed}
          className={cn(
            "mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            revealed
              ? "border-brand text-brand"
              : "border-border text-foreground hover:border-brand hover:text-brand",
          )}
        >
          {revealed ? (
            <EyeOff className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Eye className="h-4 w-4" strokeWidth={1.75} />
          )}
          <span className="sr-only">
            {revealed ? "Hide value" : "Reveal value"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
