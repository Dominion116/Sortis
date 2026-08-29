import { getSql, type Sql } from "@/lib/db/client";

/**
 * Schema bootstrap.
 *
 * Idempotent `CREATE TABLE IF NOT EXISTS`, run at the top of the cron routes
 * rather than as a separate migration step. There is no ORM and no migration
 * tool on purpose: the schema is four tables serving one read pattern, and a
 * migration framework would be more moving parts than the thing it manages.
 *
 * If the schema ever needs a breaking change, add a new column with a default
 * rather than altering an existing one, so an older deployment reading the same
 * database does not fail.
 */

let ensured = false;

export async function ensureSchema(): Promise<Sql | null> {
  const sql = getSql();
  if (!sql) return null;
  if (ensured) return sql;

  // Round metadata. Every plaintext column here is a value the draw engine
  // already emitted in an event, so nothing confidential is stored.
  await sql`
    CREATE TABLE IF NOT EXISTS rounds (
      pool_id              text    NOT NULL,
      round_id             bigint  NOT NULL,
      state                int,
      frozen_ticket_count  bigint,
      revealed_total       bigint,
      revealed_random      bigint,
      prize_amount         bigint,
      closed_at_block      bigint,
      settled_at_block     bigint,
      sweep_first_block    bigint,
      sweep_last_block     bigint,
      settled              boolean NOT NULL DEFAULT false,
      rolled_over          boolean NOT NULL DEFAULT false,
      -- Set when a claim landed inside this round's sweep window, which makes
      -- the handle delta uninterpretable. The UI must say so rather than show
      -- a number it cannot stand behind.
      delta_unreliable     boolean NOT NULL DEFAULT false,
      updated_at           timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (pool_id, round_id)
    )
  `;

  // The full Ernie trail, so /verify/[roundId] is not bounded to the last
  // 100,000 blocks the way a public-RPC getLogs call has to be.
  await sql`
    CREATE TABLE IF NOT EXISTS round_events (
      pool_id      text   NOT NULL,
      round_id     bigint NOT NULL,
      event_name   text   NOT NULL,
      block_number bigint NOT NULL,
      tx_hash      text   NOT NULL,
      log_index    int    NOT NULL,
      args         jsonb  NOT NULL,
      PRIMARY KEY (tx_hash, log_index)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS round_events_lookup
      ON round_events (pool_id, round_id)
  `;

  // Ciphertext handles at each round boundary. Public data: the same handles
  // are readable from pool storage. Useless without the owner's authorisation.
  await sql`
    CREATE TABLE IF NOT EXISTS claimable_snapshots (
      pool_id       text   NOT NULL,
      round_id      bigint NOT NULL,
      address       text   NOT NULL,
      handle_before text,
      handle_after  text,
      updated_at    timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (pool_id, round_id, address)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS claimable_snapshots_address
      ON claimable_snapshots (address, pool_id)
  `;

  // How far the event indexer has walked, per pool.
  await sql`
    CREATE TABLE IF NOT EXISTS indexer_cursor (
      pool_id    text   PRIMARY KEY,
      last_block bigint NOT NULL
    )
  `;

  ensured = true;
  return sql;
}
