"use client";

import * as React from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/contracts";
import { walletConnectReady } from "@/lib/wagmi";
import { getAppKit } from "@/lib/appkit";
import Link from "next/link";

/**
 * Connect / disconnect control.
 *
 * AppKit is created lazily by `getAppKit`, after the user asks to connect. This
 * keeps its remote WalletConnect startup requests off pages that do not need a
 * wallet and avoids turning a transient relay failure into a page error.
 *
 * With no project id there is no modal, so we connect the injected connector
 * directly. That keeps a fresh clone of the repo usable with MetaMask alone.
 *
 * `isConnected` is rendered directly, with no `mounted` guard: wagmi hydrated
 * from the cookie during the server pass, so there is no disconnected frame to
 * flash, and a guard here would reintroduce the very flash it is meant to fix.
 */
export function ConnectButton({ className }: { className?: string }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  const injected = connectors.find((connector) => connector.type === "injected");

  const handleConnect = React.useCallback(() => {
    if (walletConnectReady) {
      void getAppKit()?.open();
      return;
    }

    if (injected) {
      connect({ connector: injected });
    }
  }, [connect, injected]);

  if (isConnected && address) {
    return (
      <div className={className}>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnect()}
          className="rounded-full tabular font-mono"
          title={address}
        >
          {formatAddress(address)}
        </Button>
      </div>
    );
  }

  return (
    <div className={className}>
      {walletConnectReady || injected ? (
        <Button className="rounded-full" size="sm" onClick={handleConnect} loading={isPending}>Connect wallet</Button>
      ) : (
        <Button asChild className="rounded-full" size="sm"><Link href="/app">Connect wallet</Link></Button>
      )}
    </div>
  );
}
