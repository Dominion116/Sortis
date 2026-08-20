import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * Tracks the reduced-motion preference reactively. Returns false during SSR
 * and the hydration pass so the server and client agree on the first paint,
 * then flips to the real value once mounted.
 */
export function useReducedMotion() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** True only after hydration, for gating anything that must not render on the server. */
export function useHasMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
