/**
 * Browser-only loader for the Zama Relayer SDK.
 *
 * This module must never be imported at the top level of anything that renders
 * on the server. `@zama-fhe/relayer-sdk/web` pulls in `tfhe`, which is a WASM
 * module compiled for the browser: importing it during the Next.js server pass
 * throws before any of our code runs. That is the "Relayer SDK / App Router SSR
 * conflict" the PRD flags as a launch risk.
 *
 * The defence is layered, and all three layers matter:
 *
 *   1. every entry point here is an `async function` that `await import(...)`s
 *      the SDK, so module evaluation is deferred to call time;
 *   2. `loadSdk` refuses to run when `window` is undefined, so a stray server
 *      import fails loudly with our message instead of a WASM stack trace;
 *   3. `FhevmProvider` is itself mounted through `next/dynamic` with
 *      `ssr: false`, so in practice step 2 never fires.
 *
 * `initSDK()` fetches and compiles the WASM. It is idempotent per page load in
 * the SDK, but we also memoise the whole bootstrap so a remount does not pay
 * for it twice.
 */
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/web";

import { createSepoliaReadProvider } from "@/lib/fhevm/host-rpc";

export type { FhevmInstance };

/** Memoised bootstrap. One WASM compile and one instance per page load. */
let instancePromise: Promise<FhevmInstance> | null = null;

function assertBrowser() {
  if (typeof window === "undefined") {
    throw new Error(
      "The Zama Relayer SDK is browser-only. This module was imported during " +
        "server rendering. Mount FhevmProvider through next/dynamic with " +
        "ssr: false instead of importing the SDK at module scope.",
    );
  }
}

/**
 * Compile the WASM and build an instance for the Sepolia host chain.
 *
 * `SepoliaConfig` carries the Zama Protocol contract addresses (ACL, KMS
 * verifier, relayer URL) for Sepolia. Host-chain reads go through a
 * same-origin `/api/rpc` proxy rather than `window.ethereum` or a public RPC
 * hostname. Injected wallets intercept some public JSON-RPC hosts and reject
 * the InputVerifier `eip712Domain()` call, which makes every encrypted screen
 * fail during SDK setup even though the call is valid on Sepolia. Wallets
 * remain responsible for signing through wagmi.
 */
async function bootstrap(): Promise<FhevmInstance> {
  assertBrowser();

  const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");

  await initSDK();

  return createInstance({
    ...SepoliaConfig,
    // The SDK's Eip1193Provider type is not exported. This object is a
    // structural match: it only implements `request`.
    network: createSepoliaReadProvider() as never,
  });
}

/** Load (or reuse) the SDK instance. Safe to call from many components. */
export function loadSdk(): Promise<FhevmInstance> {
  if (!instancePromise) {
    instancePromise = bootstrap().catch((error: unknown) => {
      // Do not cache a rejection: a user who connects their wallet after the
      // first failed attempt should be able to retry without a page reload.
      instancePromise = null;
      throw error;
    });
  }

  return instancePromise;
}

/** Drop the memoised instance, so the next `loadSdk` rebuilds it. */
export function resetSdk() {
  instancePromise = null;
}
