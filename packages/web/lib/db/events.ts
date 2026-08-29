import { ensureSchema } from "@/lib/db/schema";
import type { PoolId } from "@/lib/draws";

/** One indexed Ernie log. `args` is stringified because event fields are uint64. */
export interface EventRecord {
  poolId: PoolId;
  roundId: bigint;
  eventName: string;
  blockNumber: bigint;
  txHash: string;
  logIndex: number;
  args: Record<string, string>;
}

/**
 * Persist a batch of events.
 *
 * Keyed on `(tx_hash, log_index)`, so re-indexing a block range is safe. That
 * matters because the cron scheduler will retry, and because the cursor is
 * advanced only after a successful write.
 */
export async function insertEvents(events: EventRecord[]): Promise<number> {
  const sql = await ensureSchema();
  if (!sql || events.length === 0) return 0;

  let written = 0;
  for (const event of events) {
    await sql`
      INSERT INTO round_events (pool_id, round_id, event_name, block_number, tx_hash, log_index, args)
      VALUES (
        ${event.poolId},
        ${event.roundId.toString()},
        ${event.eventName},
        ${event.blockNumber.toString()},
        ${event.txHash},
        ${event.logIndex},
        ${JSON.stringify(event.args)}
      )
      ON CONFLICT (tx_hash, log_index) DO NOTHING
    `;
    written += 1;
  }
  return written;
}

/** Every recorded event for a round, oldest first. */
export async function getRoundEvents(poolId: PoolId, roundId: bigint): Promise<EventRecord[]> {
  const sql = await ensureSchema();
  if (!sql) return [];

  const rows = (await sql`
    SELECT * FROM round_events
    WHERE pool_id = ${poolId} AND round_id = ${roundId.toString()}
    ORDER BY block_number ASC, log_index ASC
  `) as Record<string, unknown>[];

  return rows.map((row) => ({
    poolId,
    roundId,
    eventName: String(row.event_name),
    blockNumber: BigInt(String(row.block_number)),
    txHash: String(row.tx_hash),
    logIndex: Number(row.log_index),
    args: row.args as Record<string, string>,
  }));
}

/** Settled rounds for a pool, newest first, for the draws history list. */
export async function getSettledRounds(
  poolId: PoolId,
  limit = 8,
): Promise<{ roundId: string; prize: string; txHash: string }[]> {
  const sql = await ensureSchema();
  if (!sql) return [];

  const rows = (await sql`
    SELECT round_id, args, tx_hash
    FROM round_events
    WHERE pool_id = ${poolId} AND event_name = 'ErnieSettled'
    ORDER BY block_number DESC
    LIMIT ${limit}
  `) as Record<string, unknown>[];

  return rows.map((row) => {
    const args = row.args as Record<string, string>;
    return {
      roundId: String(row.round_id),
      prize: String(args.prizeAmount ?? "0"),
      txHash: String(row.tx_hash),
    };
  });
}

export async function getCursor(poolId: PoolId): Promise<bigint | null> {
  const sql = await ensureSchema();
  if (!sql) return null;

  const rows = (await sql`
    SELECT last_block FROM indexer_cursor WHERE pool_id = ${poolId}
  `) as Record<string, unknown>[];

  const row = rows[0];
  return row ? BigInt(String(row.last_block)) : null;
}

export async function setCursor(poolId: PoolId, block: bigint): Promise<void> {
  const sql = await ensureSchema();
  if (!sql) return;

  await sql`
    INSERT INTO indexer_cursor (pool_id, last_block)
    VALUES (${poolId}, ${block.toString()})
    ON CONFLICT (pool_id) DO UPDATE SET last_block = EXCLUDED.last_block
  `;
}
