/**
 * Read-only Sepolia transport for FHEVM SDK bootstrap.
 *
 * `createInstance` must call `eip712Domain()` on the Zama InputVerifier. Some
 * injected wallets intercept JSON-RPC to well-known public hosts and reject
 * that call, which is what turned every encrypted screen into a
 * CALL_EXCEPTION even after we stopped passing `window.ethereum`. The browser
 * therefore talks to a same-origin `/api/rpc` proxy. Public RPC URLs are a
 * last resort only when that proxy is unreachable.
 */

import { sepoliaUpstreamRpcUrls } from "@/lib/fhevm/rpc-urls";

const REQUEST_TIMEOUT_MS = 12_000;

type JsonRpcError = { message?: string };
type JsonRpcResponse = { result?: unknown; error?: JsonRpcError };

export function createSepoliaReadProvider() {
  return {
    request: async ({ method, params }: { method: string; params?: unknown }) => {
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [];
      }

      try {
        return await jsonRpcCall(sameOriginRpcUrl(), method, params);
      } catch (proxyError) {
        if (!isUnreachable(proxyError)) throw toError(proxyError);

        let lastError = toError(proxyError);
        for (const url of sepoliaUpstreamRpcUrls()) {
          try {
            return await jsonRpcCall(url, method, params);
          } catch (error) {
            lastError = toError(error);
          }
        }
        throw lastError;
      }
    },
  };
}

export function formatFhevmError(error: unknown): string {
  const message = toError(error).message;
  if (/missing revert data|CALL_EXCEPTION|eip712Domain|0x84b0196e/i.test(message)) {
    return "Could not read the Zama protocol contracts on Sepolia. Try again in a moment.";
  }
  if (/failed to fetch|networkerror|load failed|timed out|cors/i.test(message)) {
    return "Could not reach Sepolia. Check your connection and try again.";
  }
  return message.split("\n")[0] || "Unknown error.";
}

function sameOriginRpcUrl(): string {
  return `${window.location.origin}/api/rpc`;
}

async function jsonRpcCall(url: string, method: string, params: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params: params ?? [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Sepolia RPC returned ${response.status}.`);
    }

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(json.error.message || "Sepolia RPC error.");
    }
    return json.result;
  } catch (error) {
    if (toError(error).name === "AbortError") {
      throw new Error("Sepolia RPC timed out.");
    }
    throw toError(error);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function isUnreachable(error: unknown): boolean {
  return /failed to fetch|load failed|networkerror|timed out|returned 404|returned 5\d\d/i.test(
    toError(error).message,
  );
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
