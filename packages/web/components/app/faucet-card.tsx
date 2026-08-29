"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { Button } from "@/components/ui/button";
import { ConnectButton } from "@/components/app/connect-button";
import { Skeleton } from "@/components/app/encrypted-gate";
import { useNetworkMismatch } from "@/components/app/network-guard";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  explorerTxUrl,
  formatTokenAmount,
  sepolia,
  sortisFaucetAbi,
  SEPOLIA_CHAIN_ID,
  TOKEN_SYMBOL,
  type Address,
} from "@/lib/contracts";

/** Turn a wallet error into one line a user can act on. */
function readableError(error: Error): string {
  const message = error.message;

  if (/User rejected|denied transaction/i.test(message)) {
    return "You rejected the transaction in your wallet.";
  }
  if (/CooldownNotElapsed/.test(message)) {
    return "The cooldown has not elapsed for this address yet.";
  }
  if (/OnlyMinter/.test(message)) {
    return "The faucet is not authorised to mint. The token's faucet address needs to be set.";
  }
  if (/insufficient funds/i.test(message)) {
    return "Not enough Sepolia ETH to pay for gas.";
  }

  return message.split("\n")[0];
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "ready";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
  return `${remainder}s`;
}

export function FaucetCard() {
  const { address, isConnected } = useAccount();
  const wrongNetwork = useNetworkMismatch();
  const faucet = sepolia.faucet as Address | null;

  // A ticking clock, so the cooldown counts down without re-reading the chain.
  const [now, setNow] = React.useState(() => Math.floor(Date.now() / 1000));
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const contract = { address: faucet ?? undefined, abi: sortisFaucetAbi, chainId: SEPOLIA_CHAIN_ID } as const;

  // Both reads are plaintext view calls, so they resolve without the Relayer
  // SDK and without a connected wallet. This card is intentionally not wrapped
  // in EncryptedGate: gating a public mint behind WASM would be wrong.
  const { data: dripAmount, isLoading: amountLoading } = useReadContract({
    ...contract,
    functionName: "dripAmount",
    query: { enabled: Boolean(faucet) },
  });

  const {
    data: readyAt,
    isLoading: readyLoading,
    refetch: refetchReadyAt,
  } = useReadContract({
    ...contract,
    functionName: "readyAt",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(faucet && address) },
  });

  const { writeContractAsync, data: hash, error: writeError, reset } = useWriteContract();
  const { isPending: isActionPending, run } = useAsyncAction();

  const {
    isLoading: confirming,
    isSuccess: confirmed,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  // Re-read the cooldown once the drip lands, so the button locks itself.
  React.useEffect(() => {
    if (confirmed) void refetchReadyAt();
  }, [confirmed, refetchReadyAt]);

  const secondsLeft = readyAt !== undefined ? Number(readyAt) - now : 0;
  const onCooldown = secondsLeft > 0;
  // `signing` comes from this component, not from wagmi's `isPending`, because
  // wagmi only flips that once the connector request has started, which is
  // visibly after the click. `run` sets it synchronously instead.
  const signing = isActionPending("drip");
  const busy = signing || confirming;
  const error = writeError ?? receiptError;

  const handleDrip = React.useCallback(() => {
    if (!faucet) return;
    void run("drip", async () => {
      reset();
      try {
        await writeContractAsync({
          address: faucet,
          abi: sortisFaucetAbi,
          functionName: "drip",
          chainId: SEPOLIA_CHAIN_ID,
        });
      } catch {
        // `writeError` already carries this for the message below. Swallowing
        // the rejection here only stops it becoming an unhandled rejection.
      }
    });
  }, [faucet, writeContractAsync, reset, run]);

  if (!faucet) {
    return (
      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <p className="text-sm font-medium text-foreground">Faucet not deployed</p>
        <p className="mt-2 font-sans text-sm text-muted-foreground">
          The generated address module has no faucet address. Run the deploy
          script against Sepolia, then reload.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
      <dl className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-1">
          <dt className="font-sans text-xs tracking-wide text-muted-foreground uppercase">
            Amount per claim
          </dt>
          <dd className="tabular font-mono text-2xl text-foreground">
            {amountLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : dripAmount !== undefined ? (
              `${formatTokenAmount(dripAmount)} ${TOKEN_SYMBOL}`
            ) : (
              "unavailable"
            )}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-sans text-xs tracking-wide text-muted-foreground uppercase">
            Your next claim
          </dt>
          <dd className="tabular font-mono text-2xl text-foreground">
            {!isConnected ? (
              <span className="font-sans text-base text-muted-foreground">
                Connect to check
              </span>
            ) : readyLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              formatCountdown(secondsLeft)
            )}
          </dd>
        </div>
      </dl>

      {!isConnected ? (
        <ConnectButton />
      ) : (
        <div className="space-y-3">
          <Button
            onClick={handleDrip}
            loading={busy}
            disabled={wrongNetwork || onCooldown}
            className="w-full sm:w-auto"
          >
            {confirming ? "Confirming" : signing ? "Check your wallet" : `Claim ${TOKEN_SYMBOL}`}
          </Button>

          {wrongNetwork ? (
            <p className="font-sans text-xs text-muted-foreground">
              Switch to Sepolia first, using the banner above.
            </p>
          ) : onCooldown ? (
            <p className="font-sans text-xs text-muted-foreground">
              You have claimed recently. Try again in {formatCountdown(secondsLeft)}.
            </p>
          ) : null}
        </div>
      )}

      {confirmed && hash ? (
        <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg border border-brand/40 bg-brand/5 p-4">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {TOKEN_SYMBOL} minted to your wallet
            </p>
            <a
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-brand hover:underline"
            >
              View transaction
            </a>
          </div>
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">The claim did not go through</p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
            {readableError(error)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
