"use client";

import * as React from "react";
import { useAccount } from "wagmi";

import { loadSdk, resetSdk, type FhevmInstance } from "@/lib/fhevm/sdk";

export type FhevmStatus = "idle" | "loading" | "ready" | "error";

export interface FhevmContextValue {
  /** The SDK instance, or null until `ready`. */
  instance: FhevmInstance | null;
  /** True only when `instance` is non-null and usable. */
  ready: boolean;
  status: FhevmStatus;
  error: Error | null;
  /** Retry after a failure, or force a rebuild. */
  reload: () => void;
}

const FhevmContext = React.createContext<FhevmContextValue | null>(null);

/** What the bootstrap produced. One state object, so the three fields cannot
 * disagree with each other the way three separate `useState` calls can. */
type Loaded =
  | { kind: "pending" }
  | { kind: "ready"; instance: FhevmInstance }
  | { kind: "error"; error: Error };

/**
 * Owns the Relayer SDK lifecycle and exposes `{ instance, ready }`.
 *
 * Mounted client-only. `components/providers/index.tsx` pulls this in through
 * `next/dynamic` with `ssr: false`, so nothing in this file, or in the SDK it
 * loads, is evaluated during the server pass.
 *
 * The bootstrap is gated on `isConnected`: the SDK needs an injected provider
 * to read the network's public key, so starting it before a wallet exists just
 * produces a guaranteed failure. Non-ciphertext reads (pool sizes, countdowns,
 * the faucet cooldown) go through wagmi and never touch this context, which is
 * what keeps them off the WASM's critical path.
 */
export function FhevmProvider({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();

  const [loaded, setLoaded] = React.useState<Loaded>({ kind: "pending" });
  const [attempt, setAttempt] = React.useState(0);

  const reload = React.useCallback(() => {
    resetSdk();
    setLoaded({ kind: "pending" });
    setAttempt((value) => value + 1);
  }, []);

  React.useEffect(() => {
    if (!isConnected) {
      // Disconnecting invalidates the instance: it is bound to the provider
      // injected at bootstrap time. No setState here, because `status` below
      // derives the disconnected case from `isConnected` directly. Setting it
      // in the effect would be a cascading render, and the lint rule that
      // forbids it is right.
      resetSdk();
      return;
    }

    let cancelled = false;

    loadSdk()
      .then((instance) => {
        if (!cancelled) setLoaded({ kind: "ready", instance });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setLoaded({
          kind: "error",
          error: caught instanceof Error ? caught : new Error(String(caught)),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [isConnected, attempt]);

  const value = React.useMemo<FhevmContextValue>(() => {
    // Everything is derived from `isConnected` plus the one state object, so
    // there is no combination of values that can contradict itself.
    if (!isConnected) {
      return { instance: null, ready: false, status: "idle", error: null, reload };
    }

    if (loaded.kind === "ready") {
      return {
        instance: loaded.instance,
        ready: true,
        status: "ready",
        error: null,
        reload,
      };
    }

    if (loaded.kind === "error") {
      return {
        instance: null,
        ready: false,
        status: "error",
        error: loaded.error,
        reload,
      };
    }

    return { instance: null, ready: false, status: "loading", error: null, reload };
  }, [isConnected, loaded, reload]);

  return <FhevmContext.Provider value={value}>{children}</FhevmContext.Provider>;
}

/**
 * Read the SDK context.
 *
 * Returns an inert `idle` value rather than throwing when no provider is
 * mounted. Because `FhevmProvider` is loaded with `ssr: false`, the very first
 * client render of any page happens before it exists, and a hook that threw
 * there would take down the whole tree on first paint.
 */
export function useFhevm(): FhevmContextValue {
  const context = React.useContext(FhevmContext);

  if (context) return context;

  return {
    instance: null,
    ready: false,
    status: "idle",
    error: null,
    reload: () => {},
  };
}
