import { NextResponse } from "next/server";

import { sepoliaUpstreamRpcUrls } from "@/lib/fhevm/rpc-urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_METHODS = new Set([
  "eth_chainId",
  "eth_call",
  "eth_blockNumber",
  "eth_getCode",
  "eth_getBlockByNumber",
  "net_version",
]);

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const replies = [];
    for (const item of body) {
      replies.push(
        isRecord(item)
          ? await handleRequest(item)
          : {
              jsonrpc: "2.0",
              id: null,
              error: { code: -32600, message: "Invalid request" },
            },
      );
    }
    return NextResponse.json(replies);
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid JSON-RPC payload" }, { status: 400 });
  }

  return NextResponse.json(await handleRequest(body));
}

async function handleRequest(payload: JsonRpcRequest) {
  const id = payload.id ?? null;
  const method = typeof payload.method === "string" ? payload.method : "";

  if (!ALLOWED_METHODS.has(method)) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Method not allowed: ${method || "unknown"}` },
    };
  }

  const rpcBody = {
    jsonrpc: "2.0",
    id: id ?? 1,
    method,
    params: payload.params ?? [],
  };

  let lastError: unknown;
  for (const url of sepoliaUpstreamRpcUrls()) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rpcBody),
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        lastError = new Error(`${url} returned ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      lastError = error;
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    error: {
      code: -32000,
      message: lastError instanceof Error ? lastError.message : "All Sepolia RPC upstreams failed.",
    },
  };
}

function isRecord(value: unknown): value is JsonRpcRequest {
  return typeof value === "object" && value !== null;
}
