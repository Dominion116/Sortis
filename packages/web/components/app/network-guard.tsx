"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { isSupportedChain } from "@/lib/wagmi";

/**
 * True when a wallet is connected but pointed somewhere other than Sepolia.
 *
 * Exposed as a hook so a form can disable its submit button on the same
 * condition the banner renders on, instead of letting a user sign a
 * transaction that is guaranteed to hit the wrong contracts.
 */
export function useNetworkMismatch(): boolean {
  const { isConnected, chainId } = useAccount();
  return isConnected && !isSupportedChain(chainId);
}

/**
 * Network-mismatch banner with a one-click switch.
 *
 * Renders nothing when the chain is right, or when no wallet is connected:
 * a visitor who has not connected is not on the wrong network, they are on no
 * network, and telling them to switch would be noise.
 *
 * `switchChain` asks the wallet to change chains, and on a wallet that does
 * not know Sepolia this surfaces as a rejection rather than a silent no-op,
 * hence the error line.
 */
export function NetworkGuard({ className }: { className?: string }) {
  const mismatch = useNetworkMismatch();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!mismatch) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-brand/40 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-foreground">Wrong network</p>
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            Sortis runs on Ethereum Sepolia. Switch networks to deposit, withdraw
            or claim.
            {error ? ` ${error.message}` : ""}
          </p>
        </div>
      </div>
      <Button
        size="sm"
        onClick={() => switchChain({ chainId: SEPOLIA_CHAIN_ID })}
        loading={isPending}
        className="shrink-0"
      >
        Switch to Sepolia
      </Button>
    </div>
  );
}
