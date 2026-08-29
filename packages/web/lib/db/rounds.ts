import { ensureSchema } from "@/lib/db/schema";
import type { PoolId } from "@/lib/draws";

/**
 * Typed queries over the indexed tables.
 *
 * Every function returns an empty result or a no-op when no database is
 * configured, so callers do not each need a `databaseConfigured()` branch.
 * Postgres `bigint` arrives as a string over the HTTP driver, hence the
 * explicit `toBigInt` conversions rather than trusting the driver's typing.
 */

function toBigInt(value: unknown): bigint | undefined {
  if (value === null || value === undefined) return undefined;
  return BigInt(String(value));
}

export interface RoundRecord {
  poolId: PoolId;
  roundId: bigint;
  state?: number;
  frozenTicketCount?: bigint;
  revealedTotal?: bigint;
  revealedRandom?: bigint;
  prizeAmount?: bigint;
  sweepFirstBlock?: bigint;
  sweepLastBlock?: bigint;
  settled: boolean;
  rolledOver: boolean;
  deltaUnreliable: boolean;
}

export interface SnapshotRecord {
  poolId: PoolId;
  roundId: bigint;
  handleBefore?: string;
  handleAfter?: string;
}

/** Upsert whatever fields of a round are currently known. */
export async function upsertRound(record: {
  poolId: PoolId;
  roundId: bigint;
  state?: number;
  frozenTicketCount?: bigint;
  revealedTotal?: bigint;
  revealedRandom?: bigint;
  prizeAmount?: bigint;
  closedAtBlock?: bigint;
  settledAtBlock?: bigint;
  sweepFirstBlock?: bigint;
  sweepLastBlock?: bigint;
  settled?: boolean;
  rolledOver?: boolean;
  deltaUnreliable?: boolean;
}): Promise<void> {
  const sql = await ensureSchema();
  if (!sql) return;

  // COALESCE on the excluded value keeps a later partial update from erasing a
  // field an earlier one filled in. Boolean flags use OR for the same reason:
  // once a round is settled or flagged unreliable, it stays that way.
  await sql`
    INSERT INTO rounds (
      pool_id, round_id, state, frozen_ticket_count, revealed_total,
      revealed_random, prize_amount, closed_at_block, settled_at_block,
      sweep_first_block, sweep_last_block, settled, rolled_over, delta_unreliable
    ) VALUES (
      ${record.poolId},
      ${record.roundId.toString()},
      ${record.state ?? null},
      ${record.frozenTicketCount?.toString() ?? null},
      ${record.revealedTotal?.toString() ?? null},
      ${record.revealedRandom?.toString() ?? null},
      ${record.prizeAmount?.toString() ?? null},
      ${record.closedAtBlock?.toString() ?? null},
      ${record.settledAtBlock?.toString() ?? null},
      ${record.sweepFirstBlock?.toString() ?? null},
      ${record.sweepLastBlock?.toString() ?? null},
      ${record.settled ?? false},
      ${record.rolledOver ?? false},
      ${record.deltaUnreliable ?? false}
    )
    ON CONFLICT (pool_id, round_id) DO UPDATE SET
      state               = COALESCE(EXCLUDED.state, rounds.state),
      frozen_ticket_count = COALESCE(EXCLUDED.frozen_ticket_count, rounds.frozen_ticket_count),
      revealed_total      = COALESCE(EXCLUDED.revealed_total, rounds.revealed_total),
      revealed_random     = COALESCE(EXCLUDED.revealed_random, rounds.revealed_random),
      prize_amount        = COALESCE(EXCLUDED.prize_amount, rounds.prize_amount),
      closed_at_block     = COALESCE(EXCLUDED.closed_at_block, rounds.closed_at_block),
      settled_at_block    = COALESCE(EXCLUDED.settled_at_block, rounds.settled_at_block),
      sweep_first_block   = LEAST(COALESCE(EXCLUDED.sweep_first_block, rounds.sweep_first_block), COALESCE(rounds.sweep_first_block, EXCLUDED.sweep_first_block)),
      sweep_last_block    = GREATEST(COALESCE(EXCLUDED.sweep_last_block, rounds.sweep_last_block), COALESCE(rounds.sweep_last_block, EXCLUDED.sweep_last_block)),
      settled             = rounds.settled OR EXCLUDED.settled,
      rolled_over         = rounds.rolled_over OR EXCLUDED.rolled_over,
      delta_unreliable    = rounds.delta_unreliable OR EXCLUDED.delta_unreliable,
      updated_at          = now()
  `;
}

export async function getRound(poolId: PoolId, roundId: bigint): Promise<RoundRecord | null> {
  const sql = await ensureSchema();
  if (!sql) return null;

  const rows = (await sql`
    SELECT * FROM rounds WHERE pool_id = ${poolId} AND round_id = ${roundId.toString()}
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  return {
    poolId,
    roundId,
    state: row.state === null ? undefined : Number(row.state),
    frozenTicketCount: toBigInt(row.frozen_ticket_count),
    revealedTotal: toBigInt(row.revealed_total),
    revealedRandom: toBigInt(row.revealed_random),
    prizeAmount: toBigInt(row.prize_amount),
    sweepFirstBlock: toBigInt(row.sweep_first_block),
    sweepLastBlock: toBigInt(row.sweep_last_block),
    settled: Boolean(row.settled),
    rolledOver: Boolean(row.rolled_over),
    deltaUnreliable: Boolean(row.delta_unreliable),
  };
}

/** Rounds this address has a recorded snapshot for, newest first. */
export async function listRoundsForAddress(address: string): Promise<RoundRecord[]> {
  const sql = await ensureSchema();
  if (!sql) return [];

  const rows = (await sql`
    SELECT r.*
    FROM rounds r
    JOIN claimable_snapshots s
      ON s.pool_id = r.pool_id AND s.round_id = r.round_id
    WHERE s.address = ${address.toLowerCase()}
    ORDER BY r.round_id DESC
    LIMIT 50
  `) as Record<string, unknown>[];

  return rows.map((row) => ({
    poolId: String(row.pool_id) as PoolId,
    roundId: BigInt(String(row.round_id)),
    state: row.state === null ? undefined : Number(row.state),
    frozenTicketCount: toBigInt(row.frozen_ticket_count),
    revealedTotal: toBigInt(row.revealed_total),
    revealedRandom: toBigInt(row.revealed_random),
    prizeAmount: toBigInt(row.prize_amount),
    sweepFirstBlock: toBigInt(row.sweep_first_block),
    sweepLastBlock: toBigInt(row.sweep_last_block),
    settled: Boolean(row.settled),
    rolledOver: Boolean(row.rolled_over),
    deltaUnreliable: Boolean(row.delta_unreliable),
  }));
}
