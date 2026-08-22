"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";

import { projectId, sortisNetwork, wagmiAdapter, wagmiConfig } from "@/lib/wagmi";
import { siteConfig } from "@/config/site";

/**
 * The Relayer SDK is browser-only, so `FhevmProvider` is mounted through
 * `next/dynamic` with `ssr: false`. `ssr: false` is only legal inside a Client
 * Component, which is why this file carries "use client" and the root layout
 * stays a Server Component.
 *
 * Children render immediately; they do not wait on the dynamic chunk. That is
 * what keeps non-ciphertext content (pool stats, countdowns, the faucet's
 * cooldown read) off the SDK's critical path.
 */
const FhevmProvider = dynamic(
  () => import("@/components/providers/fhevm-provider").then((mod) => mod.FhevmProvider),
  { ssr: false },
);

/**
 * AppKit's modal is created once per page load, at module scope, not inside a
 * component. Creating it in a render pass registers duplicate WalletConnect
 * listeners on every remount.
 *
 * Skipped entirely without a project id: `createAppKit` throws on an empty
 * one, and we would rather degrade to injected-wallet-only than white-screen a
 * fresh clone of the repo.
 */
if (typeof window !== "undefined" && projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks: [sortisNetwork],
    defaultNetwork: sortisNetwork,
    projectId,
    metadata: {
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      icons: [`${siteConfig.url}/favicon.ico`],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });
}

/** One QueryClient per browser session, never one per render. */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Chain state is not free to read and rarely changes within a few
        // seconds. Components that need fresher data set their own interval.
        staleTime: 10_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // A fresh client per server render: one shared across requests would leak
    // one user's cached reads into another's HTML.
    return makeQueryClient();
  }

  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}

export interface ProvidersProps {
  children: React.ReactNode;
  /**
   * The request's raw cookie header, read server-side in the root layout.
   *
   * This is the piece that removes the disconnected-then-connected flash.
   * wagmi hydrates from it, so the first client render already knows the
   * wallet was connected and never paints a "Connect wallet" state it is
   * about to replace.
   */
  cookie?: string | null;
}

export function Providers({ children, cookie }: ProvidersProps) {
  const queryClient = getQueryClient();
  const initialState = cookieToInitialState(wagmiConfig as Config, cookie ?? undefined);

  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <FhevmProvider>{children}</FhevmProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
