import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

import { getDrawAddress, getPoolAddress, getRpcUrl, poolIds } from "@/lib/draws";
import { sortisDrawAbi, sortisPoolAbi } from "@/lib/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

function envPrivateKey(): `0x${string}` {
  const raw = (process.env.SORTIS_KEEPER_PRIVATE_KEY ?? "").trim();
  if (!raw) throw new Error("SORTIS_KEEPER_PRIVATE_KEY is not configured");
  return (raw.startsWith("0x") ? raw : `0x${raw}`) as `0x${string}`;
}

async function advance(poolId: (typeof poolIds)[number]) {
  const rpcUrl = getRpcUrl();
  const account = privateKeyToAccount(envPrivateKey());
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const draw = getDrawAddress(poolId);
  const pool = getPoolAddress(poolId);
  const roundId = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "drawingRoundId" });
  if (roundId === 0n) {
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "openRound" });
    await publicClient.waitForTransactionReceipt({ hash });
    return { poolId, action: "openRound", hash };
  }
  const round = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "roundAt", args: [roundId] });
  const state = Number(round.state);
  if (state === 0) {
    const expired = await publicClient.readContract({ address: pool, abi: sortisPoolAbi, functionName: "isRoundExpired" });
    if (!expired) return { poolId, action: "waiting", roundId: roundId.toString() };
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "closeRound" });
    await publicClient.waitForTransactionReceipt({ hash });
    return { poolId, action: "closeRound", roundId: roundId.toString(), hash };
  }
  if (state === 2) {
    if (round.revealedTotal > 0n) {
      const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "drawRandom" });
      await publicClient.waitForTransactionReceipt({ hash });
      return { poolId, action: "drawRandom", roundId: roundId.toString(), hash };
    }
    const handle = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "totalHandle", args: [roundId] });
    const instance = await createInstance({ ...SepoliaConfig, network: rpcUrl, ...(process.env.ZAMA_FHEVM_API_KEY ? { auth: { __type: "ApiKeyHeader", value: process.env.ZAMA_FHEVM_API_KEY } } : {}) });
    const result = await instance.publicDecrypt([handle]);
    const values = result.clearValues as Record<string, unknown>;
    const total = BigInt(String(values[handle.toLowerCase()] ?? values[handle]));
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "onTotalRevealed", args: [total, result.decryptionProof] });
    await publicClient.waitForTransactionReceipt({ hash });
    return { poolId, action: "onTotalRevealed", roundId: roundId.toString(), total: total.toString(), hash };
  }
  if (state === 3) {
    if (round.sweepCursor < round.frozenTicketCount) {
      const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "stepDraw", args: [8n] });
      await publicClient.waitForTransactionReceipt({ hash });
      return { poolId, action: "stepDraw", roundId: roundId.toString(), cursor: round.sweepCursor.toString(), hash };
    }
    const [winnerHandle, randomHandle] = await Promise.all([
      publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "winnerCountHandle", args: [roundId] }),
      publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "randomHandle", args: [roundId] }),
    ]);
    const instance = await createInstance({ ...SepoliaConfig, network: rpcUrl, ...(process.env.ZAMA_FHEVM_API_KEY ? { auth: { __type: "ApiKeyHeader", value: process.env.ZAMA_FHEVM_API_KEY } } : {}) });
    const result = await instance.publicDecrypt([winnerHandle, randomHandle]);
    const values = result.clearValues as Record<string, unknown>;
    const winnerCount = BigInt(String(values[winnerHandle.toLowerCase()] ?? values[winnerHandle]));
    const random = BigInt(String(values[randomHandle.toLowerCase()] ?? values[randomHandle]));
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "settle", args: [winnerCount, random, result.decryptionProof] });
    await publicClient.waitForTransactionReceipt({ hash });
    return { poolId, action: "settle", roundId: roundId.toString(), winnerCount: winnerCount.toString(), hash };
  }
  return { poolId, action: "idle", roundId: roundId.toString(), state };
}

export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = [];
    for (const poolId of poolIds) results.push(await advance(poolId));
    return Response.json({ ok: true, results });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
