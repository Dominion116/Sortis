"use client";

import * as React from "react";
import { useAccount, useBlockNumber, useChainId } from "wagmi";

import { cn } from "@/lib/utils";
import { ConnectButton } from "@/components/app/connect-button";
import { useFhevm } from "@/components/providers/fhevm-provider";
import { formatAddress, sepolia, SEPOLIA_CHAIN_ID } from "@/lib/contracts";
import { isSupportedChain, walletConnectReady } from "@/lib/wagmi";

type Tone = "ready" | "waiting" | "bad";

function StatusDot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        tone === "ready" && "bg-brand",
        tone === "waiting" && "bg-muted-foreground/50",
        tone === "bad" && "bg-destructive",
      )}
    />
  );
}

function Row({
  label,
  tone,
  value,
  detail,
}: {
  label: string;
  tone: Tone;
  value: string;
  detail?: string;
}) {
  return (
    <div className="grid grid-cols-[10rem_1fr] items-start gap-4 py-4 text-sm">
      <dt className="font-sans text-muted-foreground">{label}</dt>
      <dd className="space-y-1">
        <p className="flex items-center gap-2">
          <StatusDot tone={tone} />
          <span className="tabular font-mono text-foreground">{value}</span>
        </p>
        {detail ? (
          <p className="font-sans text-xs leading-relaxed text-muted-foreground">
            {detail}
          </p>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Reports the live state of every shell dependency.
 *
 * The whole point is that this component reads `useFhevm()` unconditionally and
 * does *not* wrap itself in `EncryptedGate`: it has to be able to render the
 * SDK's error state in order to be useful, which a gate would swallow.
 */
export function DiagnosticsPanel() {
  const { address, isConnected, connector } = useAccount();
  const chainId = useChainId();
  const { status: sdkStatus, error: sdkError, ready: sdkReady } = useFhevm();

  // Proves reads work end to end, not just that a provider object exists.
  const { data: blockNumber, isLoading: blockLoading } = useBlockNumber({
    chainId: SEPOLIA_CHAIN_ID,
    watch: false,
  });

  const onSepolia = isSupportedChain(chainId);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-background p-6 dark:bg-zinc-950">
        <dl className="divide-y divide-border">
          <Row
            label="Server render"
            tone="ready"
            value="ok"
            detail="This page reached the browser, so no browser-only module was evaluated during the server pass."
          />
          <Row
            label="Wallet"
            tone={isConnected ? "ready" : "waiting"}
            value={isConnected && address ? formatAddress(address) : "not connected"}
            detail={
              isConnected
                ? `Connected through ${connector?.name ?? "unknown connector"}.`
                : "Connect a wallet to exercise the remaining checks."
            }
          />
          <Row
            label="WalletConnect"
            tone={walletConnectReady ? "ready" : "waiting"}
            value={walletConnectReady ? "configured" : "injected only"}
            detail={
              walletConnectReady
                ? "A Reown project id is present, so the full wallet modal is available."
                : "No NEXT_PUBLIC_REOWN_PROJECT_ID. Injected wallets still work."
            }
          />
          <Row
            label="Network"
            tone={!isConnected ? "waiting" : onSepolia ? "ready" : "bad"}
            value={String(chainId)}
            detail={
              onSepolia
                ? "Ethereum Sepolia, which is where the Sortis contracts live."
                : "Sortis expects chain 11155111. Use the banner above to switch."
            }
          />
          <Row
            label="Sepolia read"
            tone={blockNumber ? "ready" : blockLoading ? "waiting" : "bad"}
            value={blockNumber ? `block ${blockNumber}` : blockLoading ? "reading" : "failed"}
            detail="A public RPC read through wagmi. Independent of the wallet and of the SDK."
          />
          <Row
            label="Relayer SDK"
            tone={sdkReady ? "ready" : sdkStatus === "error" ? "bad" : "waiting"}
            value={sdkStatus}
            detail={
              sdkError
                ? sdkError.message
                : sdkReady
                  ? "WASM compiled and the instance is bound to the connected wallet."
                  : "Loads once a wallet is connected. This is the check that matters most."
            }
          />
          <Row
            label="Addresses"
            tone={sepolia.token ? "ready" : "bad"}
            value={sepolia.token ? "loaded" : "missing"}
            detail={
              sepolia.token
                ? `Faucet ${formatAddress(sepolia.faucet ?? "")}, demo pool ${formatAddress(sepolia.demo.pool ?? "")}.`
                : "The generated address module is empty. Re-run the deploy script."
            }
          />
        </dl>
      </div>
      {!isConnected ? <ConnectButton /> : null}
    </div>
  );
}
