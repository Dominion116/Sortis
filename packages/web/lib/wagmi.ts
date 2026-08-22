import { cookieStorage, createStorage } from "wagmi";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { sepolia as sepoliaChain } from "@reown/appkit/networks";

import { SEPOLIA_CHAIN_ID } from "@/lib/contracts";

/**
 * Reown AppKit project id. Public by design (it is shipped to the browser and
 * only scopes WalletConnect relay traffic), so `NEXT_PUBLIC_` is correct.
 *
 * Without one, WalletConnect's relay refuses the handshake and only injected
 * wallets work. We do not throw: a reviewer cloning the repo should still get
 * a working MetaMask flow rather than a blank page. `walletConnectReady`
 * lets the UI say so out loud instead of failing silently.
 */
export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? "";

export const walletConnectReady = projectId.length > 0;

/** The one network Sortis is deployed on. Re-exported so components importing
 * chain metadata do not each reach into AppKit's networks entrypoint. */
export const sortisNetwork = sepoliaChain;
export const networks = [sepoliaChain] as const;

/**
 * Cookie storage, not `localStorage`, is what removes the disconnected-then-
 * connected flash on first paint (PRD 8 exit criterion). The server can read
 * a cookie while rendering, so wagmi's initial state already knows the wallet
 * was connected and the first HTML frame matches the hydrated tree.
 *
 * `ssr: true` is the other half: it stops wagmi from touching browser-only
 * storage during the server pass.
 */
export const wagmiAdapter = new WagmiAdapter({
  networks: [sepoliaChain],
  projectId,
  ssr: true,
  // `createStorage` returns a `Storage` keyed to wagmi's own `StorageItemMap`,
  // while AppKit's adapter declares a wider `Record<string, unknown>` key
  // space. The two are the same object at runtime, so the cast is the seam
  // between the two declarations rather than a workaround for a real mismatch.
  storage: createStorage({ storage: cookieStorage }) as never,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

/** Guard for "connected, but pointed at the wrong chain". */
export function isSupportedChain(chainId: number | undefined): boolean {
  return chainId === SEPOLIA_CHAIN_ID;
}
