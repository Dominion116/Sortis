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
  /** Static masked display with no reveal control — used for "someone else's" balance. */
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
  const [display, setDisplay] = useState(() => maskedString(value.length));
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
          <span className="text-xs uppercase tracking-[0.08em] text-mute">
            {label}
          </span>
        ) : null}
        <span
          aria-hidden="true"
          className={cn(
            "tabular font-mono leading-none tracking-[-0.01em]",
            SIZE_CLASSES[size],
            revealed ? "text-ink" : "text-mute",
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
          className="mb-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line text-ink transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
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
