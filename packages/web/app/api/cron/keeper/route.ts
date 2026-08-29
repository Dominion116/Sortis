import { createPublicClient, createWalletClient, http, type PublicClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";

import { getDrawAddress, getPoolAddress, getRpcUrl, poolIds, type PoolId } from "@/lib/draws";
import { sortisDrawAbi, sortisPoolAbi } from "@/lib/contracts";
import { getRound, upsertRound } from "@/lib/db/rounds";
import { recordHandlesAfter, recordHandlesBefore } from "@/lib/db/snapshots";
import { claimInterleaved, frozenParticipants, readClaimableHandles } from "@/lib/keeper/snapshots";

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

function relayerInstance(rpcUrl: string) {
  return createInstance({
    ...SepoliaConfig,
    network: rpcUrl,
    ...(process.env.ZAMA_FHEVM_API_KEY
      ? { auth: { __type: "ApiKeyHeader", value: process.env.ZAMA_FHEVM_API_KEY } }
      : {}),
  });
}

/**
 * Capture the `_claimable` handle for every eligible participant.
 *
 * Called at both round boundaries, always against the chain head, in the same
 * invocation as the transaction that creates the boundary. That is what keeps an
 * archive node out of the requirements.
 *
 * Any failure is swallowed on purpose: recording history must never stop a round
 * from advancing, because a stalled round is a far worse outcome than a missing
 * snapshot. A missing `handle_before` makes that one round report as
 * indeterminate on `/app/prizes` and nothing else.
 */
async function captureSnapshots(
  client: PublicClient,
  poolId: PoolId,
  roundId: bigint,
  frozenTicketCount: bigint,
  phase: "before" | "after",
): Promise<number> {
  try {
    const participants = await frozenParticipants(client, poolId, frozenTicketCount);
    if (participants.length === 0) return 0;

    const handles = await readClaimableHandles(client, poolId, participants);
    if (phase === "before") {
      await recordHandlesBefore(poolId, roundId, handles);
    } else {
      await recordHandlesAfter(poolId, roundId, handles);
    }
    return handles.length;
  } catch {
    return 0;
  }
}

async function advance(poolId: (typeof poolIds)[number]) {
  const rpcUrl = getRpcUrl();
  const account = privateKeyToAccount(envPrivateKey());
  const publicClient = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, chain: sepolia, transport: http(rpcUrl) });
  const draw = getDrawAddress(poolId);
  const pool = getPoolAddress(poolId);
  const configuredKeeper = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "keeper" });
  if (configuredKeeper.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`${poolId} keeper mismatch: contract expects ${configuredKeeper}, configured key is ${account.address}`);
  }
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
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Boundary 1. Taken after the close transaction, which is still "before the
    // sweep": closing freezes the ticket set and harvests yield, it does not
    // credit anybody. Reading it here means `frozenTicketCount` is already set,
    // so the eligible set does not have to be inferred.
    const closed = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "roundAt", args: [roundId] });
    const captured = await captureSnapshots(publicClient, poolId, roundId, closed.frozenTicketCount, "before");
    await upsertRound({
      poolId,
      roundId,
      state: Number(closed.state),
      frozenTicketCount: closed.frozenTicketCount,
      prizeAmount: closed.prizeAmount,
      closedAtBlock: receipt.blockNumber,
    }).catch(() => {});

    return { poolId, action: "closeRound", roundId: roundId.toString(), captured, hash };
  }
  if (state === 2) {
    if (round.revealedTotal > 0n) {
      const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "drawRandom" });
      await publicClient.waitForTransactionReceipt({ hash });
      return { poolId, action: "drawRandom", roundId: roundId.toString(), hash };
    }
    const handle = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "totalHandle", args: [roundId] });
    const instance = await relayerInstance(rpcUrl);
    const result = await instance.publicDecrypt([handle]);
    const values = result.clearValues as Record<string, unknown>;
    const total = BigInt(String(values[handle.toLowerCase()] ?? values[handle]));
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "onTotalRevealed", args: [total, result.decryptionProof] });
    await publicClient.waitForTransactionReceipt({ hash });
    await upsertRound({ poolId, roundId, revealedTotal: total, state: 3 }).catch(() => {});
    return { poolId, action: "onTotalRevealed", roundId: roundId.toString(), total: total.toString(), hash };
  }
  if (state === 3) {
    if (round.sweepCursor < round.frozenTicketCount) {
      const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "stepDraw", args: [8n] });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Track the sweep's block span so the claim scan at settlement knows the
      // exact window to check for an interleaved claim.
      await upsertRound({
        poolId,
        roundId,
        sweepFirstBlock: receipt.blockNumber,
        sweepLastBlock: receipt.blockNumber,
      }).catch(() => {});

      return { poolId, action: "stepDraw", roundId: roundId.toString(), cursor: round.sweepCursor.toString(), hash };
    }
    const [winnerHandle, randomHandle] = await Promise.all([
      publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "winnerCountHandle", args: [roundId] }),
      publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "randomHandle", args: [roundId] }),
    ]);
    const instance = await relayerInstance(rpcUrl);
    const result = await instance.publicDecrypt([winnerHandle, randomHandle]);
    const values = result.clearValues as Record<string, unknown>;
    const winnerCount = BigInt(String(values[winnerHandle.toLowerCase()] ?? values[winnerHandle]));
    const random = BigInt(String(values[randomHandle.toLowerCase()] ?? values[randomHandle]));
    const hash = await wallet.writeContract({ address: draw, abi: sortisDrawAbi, functionName: "settle", args: [winnerCount, random, result.decryptionProof] });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Boundary 2, plus the interleaved-claim check. `SortisPool.claim` emits no
    // event, so a claim inside the sweep window can only be found by scanning
    // the window's transactions. If one is there, the delta for this round is
    // uninterpretable and the round is flagged so the UI says so.
    const settledRound = await publicClient.readContract({ address: draw, abi: sortisDrawAbi, functionName: "roundAt", args: [roundId] });
    const captured = await captureSnapshots(publicClient, poolId, roundId, settledRound.frozenTicketCount, "after");

    // The scan window is the recorded sweep span, from the first `stepDraw`
    // block to this settlement block. If no span was recorded (no database, or
    // the keeper started mid-round) the scan is skipped rather than guessed at,
    // and `handle_before` will be missing anyway, so the round already reports
    // as indeterminate.
    const tracked = await getRound(poolId, roundId).catch(() => null);
    const unreliable = tracked?.sweepFirstBlock
      ? await claimInterleaved(publicClient, poolId, tracked.sweepFirstBlock, receipt.blockNumber).catch(() => false)
      : false;

    await upsertRound({
      poolId,
      roundId,
      state: Number(settledRound.state),
      revealedRandom: random,
      prizeAmount: settledRound.prizeAmount,
      settledAtBlock: receipt.blockNumber,
      sweepLastBlock: receipt.blockNumber,
      settled: winnerCount === 1n,
      rolledOver: winnerCount === 0n,
      deltaUnreliable: unreliable,
    }).catch(() => {});

    return { poolId, action: "settle", roundId: roundId.toString(), winnerCount: winnerCount.toString(), captured, deltaUnreliable: unreliable, hash };
  }
  return { poolId, action: "idle", roundId: roundId.toString(), state };
}

export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const results = await Promise.all(poolIds.map(async (poolId) => {
      try {
        return await advance(poolId);
      } catch (error) {
        return { poolId, action: "error", error: error instanceof Error ? error.message : String(error) };
      }
    }));
    const ok = results.every((result) => result.action !== "error");
    return Response.json({ ok, results }, { status: ok ? 200 : 500 });
  } catch (error) {
    return Response.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
