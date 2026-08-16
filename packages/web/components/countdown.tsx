"use client";

import { useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function partsUntil(target: number, now: number) {
  const remaining = Math.max(0, target - now);
  const totalSeconds = Math.floor(remaining / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/**
 * Shared one-second clock. getSnapshot must return a cached value: React 19
 * calls it twice and loops if Date.now() changes between those reads.
 */
let cachedNow = Date.now();
const clockListeners = new Set<() => void>();
let clockInterval: ReturnType<typeof setInterval> | null = null;

function subscribeToClock(onStoreChange: () => void) {
  clockListeners.add(onStoreChange);
  if (clockInterval === null) {
    clockInterval = setInterval(() => {
      cachedNow = Date.now();
      clockListeners.forEach((listener) => listener());
    }, 1000);
  }
  return () => {
    clockListeners.delete(onStoreChange);
    if (clockListeners.size === 0 && clockInterval !== null) {
      clearInterval(clockInterval);
      clockInterval = null;
    }
  };
}

function getNowSnapshot() {
  return cachedNow;
}

function getServerNowSnapshot() {
  return null;
}

/** Ticks once a second on the client; null during SSR and before hydration. */
function useNow(): number | null {
  return useSyncExternalStore(
    subscribeToClock,
    getNowSnapshot,
    getServerNowSnapshot,
  );
}

/**
 * Resolves a stable target timestamp the first time it's read on the client.
 * Modeled as its own tiny external store (rather than a ref written during
 * render) so it stays legal under strict render-purity lint rules: a store
 * is explicitly the sanctioned place to cache external, non-React state.
 */
function createTargetStore(target: Date | undefined, offsetMs: number | undefined) {
  let resolved = target ? target.getTime() : null;
  return {
    subscribe: () => () => {},
    getSnapshot: (): number | null => {
      if (resolved === null && offsetMs !== undefined) {
        resolved = Date.now() + offsetMs;
      }
      return resolved;
    },
    getServerSnapshot: (): number | null => (target ? target.getTime() : null),
  };
}

function useResolvedTarget(
  target: Date | undefined,
  offsetMs: number | undefined,
): number | null {
  const [store] = useState(() => createTargetStore(target, offsetMs));
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );
}

const SIZE_CLASSES = {
  sm: "text-lg",
  md: "text-3xl sm:text-4xl",
  lg: "text-6xl sm:text-7xl",
} as const;

interface CountdownProps {
  /** Fixed target instant. */
  target?: Date;
  /**
   * Alternative to `target`: count down from the moment this component
   * mounts, offset by this many milliseconds. Avoids a countdown that reads
   * stale after a statically-rendered page has sat on Vercel for a while.
   */
  offsetMs?: number;
  className?: string;
  size?: keyof typeof SIZE_CLASSES;
}

export function Countdown({
  target,
  offsetMs,
  className,
  size = "md",
}: CountdownProps) {
  const now = useNow();
  const targetMs = useResolvedTarget(target, offsetMs);
  const ready = now !== null && targetMs !== null;
  const parts = ready
    ? partsUntil(targetMs, now)
    : { days: 0, hours: 0, minutes: 0, seconds: 0 };

  return (
    <div
      role="timer"
      aria-live="off"
      className={cn(
        "tabular font-mono leading-none tracking-[-0.01em] text-foreground",
        SIZE_CLASSES[size],
        !ready && "invisible",
        className,
      )}
    >
      {pad(parts.days)}
      <span className="text-muted-foreground">d</span> {pad(parts.hours)}
      <span className="text-muted-foreground">h</span> {pad(parts.minutes)}
      <span className="text-muted-foreground">m</span> {pad(parts.seconds)}
      <span className="text-muted-foreground">s</span>
    </div>
  );
}
