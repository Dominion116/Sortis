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
 * Compile the WASM and build an instance bound to the injected wallet.
 *
 * `SepoliaConfig` carries the Zama Protocol contract addresses (ACL, KMS
 * verifier, relayer URL) for Sepolia. Only `network` is ours to supply, and
 * `window.ethereum` is the right value: the SDK uses it to read the public key
 * material from chain, not to sign, so it does not need wagmi's transport.
 */
async function bootstrap(): Promise<FhevmInstance> {
  assertBrowser();

  const { createInstance, initSDK, SepoliaConfig } = await import("@zama-fhe/relayer-sdk/web");

  await initSDK();

  // `window.ethereum` is already declared by another dependency in this graph
  // (as `Record<string, unknown>`), so we read it through a local cast rather
  // than re-declaring the global, which would be a duplicate-declaration
  // error. The SDK's own `Eip1193Provider` type is not exported either.
  const ethereum = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!ethereum) {
    throw new Error(
      "No injected Ethereum provider found. Connect a wallet before the " +
        "encryption SDK can read the network's public key.",
    );
  }

  return createInstance({
    ...SepoliaConfig,
    // The SDK's provider type is not exported, so this cast is the boundary
    // between our structural type and theirs.
    network: ethereum as never,
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
