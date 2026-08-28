"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { useFhevm } from "@/components/providers/fhevm-provider";
import { Button } from "@/components/ui/button";
import { formatFhevmError } from "@/lib/fhevm/host-rpc";

/**
 * Plain shimmer block. Sized by the caller so the skeleton occupies the same
 * space as the content it stands in for, which is what stops the layout
 * jumping when the SDK finishes loading.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      aria-hidden="true"
    />
  );
}

export interface EncryptedGateProps {
  children: React.ReactNode;
  /** Replaces the default three-line shimmer. */
  fallback?: React.ReactNode;
  /** Shown instead of the gate's own message when no wallet is connected. */
  disconnected?: React.ReactNode;
  /** Short label for what is waiting, used in the loading and error copy. */
  label?: string;
  className?: string;
}

function DefaultSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-32" />
    </div>
  );
}

/**
 * The single `ready`-gated wrapper for anything that encrypts or decrypts.
 *
 * Built once here, deliberately, so Phases 9 to 11 (deposit, withdraw, balance
 * reveal, sweep progress, claim) all inherit the same four states rather than
 * each inventing their own spinner:
 *
 *   idle     no wallet, so no SDK, so ask for a wallet
 *   loading  WASM compiling, show a skeleton the size of the real content
 *   error    say what broke and offer a retry
 *   ready    render children, which may now assume `instance` is non-null
 *
 * Wrap only the ciphertext-dependent subtree. Anything readable through
 * ordinary wagmi hooks should sit outside this component so it paints without
 * waiting for the WASM, which is an explicit Phase 8 requirement.
 */
export function EncryptedGate({
  children,
  fallback,
  disconnected,
  label = "encryption",
  className,
}: EncryptedGateProps) {
  const { ready, status, error, reload } = useFhevm();

  if (ready) {
    return <>{children}</>;
  }

  if (status === "error") {
    return (
      <div
        className={cn(
          "space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4",
          className,
        )}
      >
        <p className="text-sm font-medium text-foreground">
          The {label} library did not load.
        </p>
        <p className="font-sans text-xs leading-relaxed text-muted-foreground">
          {formatFhevmError(error)}
        </p>
        <Button size="sm" variant="outline" onClick={reload}>
          Try again
        </Button>
      </div>
    );
  }

  if (status === "idle") {
    return (
      <div className={className}>
        {disconnected ?? (
          <p className="font-sans text-sm text-muted-foreground">
            Connect a wallet to load the {label} library.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={className} role="status" aria-busy="true">
      <span className="sr-only">Loading the {label} library</span>
      {fallback ?? <DefaultSkeleton />}
    </div>
  );
}
