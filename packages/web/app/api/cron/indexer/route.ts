import { parseEventLogs } from "viem";

import { sortisDrawAbi } from "@/lib/contracts";
import { getCursor, insertEvents, setCursor, type EventRecord } from "@/lib/db/events";
import { upsertRound } from "@/lib/db/rounds";
import { databaseConfigured } from "@/lib/db/client";
import { getDrawAddress, makePublicClient, poolIds, type PoolId } from "@/lib/draws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Event indexer.
 *
 * Walks the Ernie trail forward from a persisted cursor and stores it, so
 * `/verify/[roundId]` and the settled-round list are not limited to the last
 * 100,000 blocks that a public-RPC `getLogs` call has to be bounded to.
 *
 * Only logs are indexed here. Ciphertext handle snapshots are captured by the
 * keeper instead, because they need a read at the exact round boundary and this
 * route makes no guarantee about when it runs.
 *
 * Idempotent: events are keyed on `(tx_hash, log_index)` and the cursor only
 * advances after a successful write, so a retry re-reads at worst one chunk.
 */

/**
 * First block to index from.
 *
 * The current Sepolia set was deployed at 2026-08-28T21:04:38Z, which resolves to
 * block 11,587,343. Verified by binary-searching block timestamps and confirming
 * `eth_getCode` on the demo draw contract is empty below it and non-empty at it.
 *
 * Do not lower this "to be safe": the backfill walks CHUNK blocks per invocation,
 * so an earlier start costs proportionally more scheduler ticks before history is
 * complete. If `deploy:sepolia` is ever re-run, update this to the new deployment
 * block.
 */
const DEPLOYMENT_BLOCK = 11_587_000n;

/** Public RPCs reject wide ranges, so walk in chunks. */
const CHUNK = 9_000n;

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

/** Stringify event args: every numeric field is a uint64 and JSON has no bigint. */
function serialiseArgs(args: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined || value === null) continue;
    out[key] = typeof value === "bigint" ? value.toString() : String(value);
  }
  return out;
}

/** Fold an event into the `rounds` row it describes, so reads need one query. */
async function applyToRound(poolId: PoolId, event: EventRecord): Promise<void> {
  const { roundId, args, blockNumber } = event;

  switch (event.eventName) {
    case "ErnieRoundClosed":
      await upsertRound({
        poolId,
        roundId,
        frozenTicketCount: BigInt(args.frozenTicketCount ?? "0"),
        closedAtBlock: blockNumber,
      });
      break;
    case "ErnieTotalRevealed":
      await upsertRound({ poolId, roundId, revealedTotal: BigInt(args.total ?? "0") });
      break;
    case "ErnieSweepAdvanced":
      await upsertRound({ poolId, roundId, sweepFirstBlock: blockNumber, sweepLastBlock: blockNumber });
      break;
    case "ErnieSettled":
      await upsertRound({
        poolId,
        roundId,
        prizeAmount: BigInt(args.prizeAmount ?? "0"),
        revealedRandom: BigInt(args.randomValue ?? "0"),
        settledAtBlock: blockNumber,
        settled: true,
      });
      break;
    case "ErnieRolledOver":
      await upsertRound({
        poolId,
        roundId,
        prizeAmount: BigInt(args.carriedPrize ?? "0"),
        settledAtBlock: blockNumber,
        rolledOver: true,
      });
      break;
    default:
      break;
  }
}

async function indexPool(poolId: PoolId) {
  const client = makePublicClient();
  const address = getDrawAddress(poolId);
  const latest = await client.getBlockNumber();

  const cursor = await getCursor(poolId);
  const fromBlock = cursor === null ? DEPLOYMENT_BLOCK : cursor + 1n;
  if (fromBlock > latest) {
    return { poolId, indexed: 0, fromBlock: fromBlock.toString(), toBlock: latest.toString() };
  }

  const toBlock = fromBlock + CHUNK > latest ? latest : fromBlock + CHUNK;
  const logs = await client.getLogs({ address, fromBlock, toBlock } as never);
  const parsed = parseEventLogs({ abi: sortisDrawAbi, logs });

  const records: EventRecord[] = [];
  for (const log of parsed) {
    const args = (log.args ?? {}) as Record<string, unknown>;
    if (args.roundId === undefined) continue;

    records.push({
      poolId,
      roundId: BigInt(String(args.roundId)),
      eventName: log.eventName,
      blockNumber: log.blockNumber ?? 0n,
      txHash: log.transactionHash ?? "",
      logIndex: log.logIndex ?? 0,
      args: serialiseArgs(args),
    });
  }

  await insertEvents(records);
  for (const record of records) {
    await applyToRound(poolId, record);
  }

  // Cursor last, so a failure above means the same range is retried rather than
  // silently skipped.
  await setCursor(poolId, toBlock);

  return {
    poolId,
    indexed: records.length,
    fromBlock: fromBlock.toString(),
    toBlock: toBlock.toString(),
    caughtUp: toBlock === latest,
  };
}

export async function GET(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  if (!databaseConfigured()) {
    // Not an error. The app is designed to run without a database; the indexer
    // simply has nowhere to write, and every read falls back to `getLogs`.
    return Response.json({ ok: true, skipped: "DATABASE_URL is not configured" });
  }

  try {
    const results = await Promise.all(
      poolIds.map(async (poolId) => {
        try {
          return await indexPool(poolId);
        } catch (error) {
          return { poolId, error: error instanceof Error ? error.message : String(error) };
        }
      }),
    );
    const ok = results.every((result) => !("error" in result));
    return Response.json({ ok, results }, { status: ok ? 200 : 500 });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
