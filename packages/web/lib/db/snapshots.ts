import { ensureSchema } from "@/lib/db/schema";
import type { PoolId } from "@/lib/draws";

/**
 * Ciphertext handle snapshots at round boundaries.
 *
 * These are the whole reason the backend exists. `_claimable` is one running
 * encrypted total, credited for every participant on every sweep with no
 * per-user event, so no single read answers "did I win round 7". Recording the
 * handle either side of a round makes the question answerable: the browser
 * decrypts both and subtracts.
 *
 * The keeper writes these inline, in the same invocation as the transaction that
 * creates the boundary, so both reads happen at the chain head. That is what
 * keeps an archive node out of the requirements: reconstructing these after the
 * fact would need historical `eth_call` depth.
 *
 * Stored handles are public. The pool grants decryption to the owning address
 * only, so serving them from an unauthenticated endpoint reveals nothing. There
 * is a contract test pinning that a non-owner cannot decrypt one.
 */

export interface HandlePair {
  address: string;
  handleBefore?: string;
  handleAfter?: string;
}

/** Record the pre-sweep handles for a round's participants. */
export async function recordHandlesBefore(
  poolId: PoolId,
  roundId: bigint,
  entries: { address: string; handle: string }[],
): Promise<void> {
  const sql = await ensureSchema();
  if (!sql || entries.length === 0) return;

  for (const entry of entries) {
    await sql`
      INSERT INTO claimable_snapshots (pool_id, round_id, address, handle_before)
      VALUES (${poolId}, ${roundId.toString()}, ${entry.address.toLowerCase()}, ${entry.handle})
      ON CONFLICT (pool_id, round_id, address) DO UPDATE SET
        handle_before = COALESCE(claimable_snapshots.handle_before, EXCLUDED.handle_before),
        updated_at = now()
    `;
  }
}

/**
 * Record the post-sweep handles for a round's participants.
 *
 * `handle_before` is left alone here. If the keeper missed the close boundary
 * (a cold start, or a database added mid-round) then `handle_before` stays null
 * and the round reports as indeterminate rather than being computed from a
 * wrong baseline.
 */
export async function recordHandlesAfter(
  poolId: PoolId,
  roundId: bigint,
  entries: { address: string; handle: string }[],
): Promise<void> {
  const sql = await ensureSchema();
  if (!sql || entries.length === 0) return;

  for (const entry of entries) {
    await sql`
      INSERT INTO claimable_snapshots (pool_id, round_id, address, handle_after)
      VALUES (${poolId}, ${roundId.toString()}, ${entry.address.toLowerCase()}, ${entry.handle})
      ON CONFLICT (pool_id, round_id, address) DO UPDATE SET
        handle_after = EXCLUDED.handle_after,
        updated_at = now()
    `;
  }
}

/** The handle pair for one address in one round, if recorded. */
export async function getHandlePair(
  poolId: PoolId,
  roundId: bigint,
  address: string,
): Promise<HandlePair | null> {
  const sql = await ensureSchema();
  if (!sql) return null;

  const rows = (await sql`
    SELECT address, handle_before, handle_after
    FROM claimable_snapshots
    WHERE pool_id = ${poolId}
      AND round_id = ${roundId.toString()}
      AND address = ${address.toLowerCase()}
  `) as Record<string, unknown>[];

  const row = rows[0];
  if (!row) return null;

  return {
    address: String(row.address),
    handleBefore: row.handle_before ? String(row.handle_before) : undefined,
    handleAfter: row.handle_after ? String(row.handle_after) : undefined,
  };
}
