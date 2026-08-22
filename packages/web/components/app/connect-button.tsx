"use client";

import * as React from "react";
import { modal } from "@reown/appkit/react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { Button } from "@/components/ui/button";
import { formatAddress } from "@/lib/contracts";
import { walletConnectReady } from "@/lib/wagmi";

/**
 * Connect / disconnect control.
 *
 * Uses AppKit's `modal` export rather than its `useAppKit()` hook. The hook
 * throws "Please call createAppKit before using useAppKit" whenever the modal
 * has not been created, which is true in two situations we actually hit: during
 * the server render pass, and in the no-project-id fallback. A throwing hook
 * takes the whole tree with it, so we read the live binding and use optional
 * chaining instead. Do not "simplify" this back to the hook.
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

  const openModal = React.useCallback(() => {
    void modal?.open();
  }, []);

  const handleConnect = React.useCallback(() => {
    if (walletConnectReady && modal) {
      void modal.open();
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
          onClick={() => (modal ? openModal() : disconnect())}
          className="tabular font-mono"
          title={address}
        >
          {formatAddress(address)}
        </Button>
      </div>
    );
  }

  if (!walletConnectReady && !injected) {
    return (
      <p className="font-sans text-sm text-muted-foreground">
        No wallet detected. Install a browser wallet, or set
        NEXT_PUBLIC_REOWN_PROJECT_ID to enable WalletConnect.
      </p>
    );
  }

  return (
    <div className={className}>
      <Button size="sm" onClick={handleConnect} loading={isPending}>
        Connect wallet
      </Button>
    </div>
  );
}
