import { neon } from "@neondatabase/serverless";

/**
 * Postgres access for the indexer and the read APIs.
 *
 * TWO RULES THIS MODULE EXISTS TO ENFORCE
 *
 * 1. Nothing stored here is private. Event arguments, round metadata and
 *    ciphertext handles are all readable from public chain state already. No
 *    plaintext amount that is not already emitted onchain, no decryption
 *    session, no private key. A handle is inert without the owner's EIP-712
 *    authorisation, which is why `/api/rounds` and `/api/prizes` can be public.
 *
 * 2. The database is optional. Without `DATABASE_URL` the keeper still advances
 *    rounds, `/verify/[roundId]` still falls back to bounded `getLogs`, and the
 *    round selector on `/app/prizes` hides itself. A reviewer cloning the repo
 *    with no database gets the pre-backend behaviour rather than a broken app,
 *    so every caller must handle `null` from `getSql()`.
 *
 * The HTTP driver is deliberate: a serverless function cannot hold a TCP pool
 * across invocations without exhausting Postgres connections.
 */

export type Sql = ReturnType<typeof neon>;

let cached: Sql | null = null;
let checked = false;

/** The connection, or null when no database is configured. */
export function getSql(): Sql | null {
  if (checked) return cached;
  checked = true;

  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;

  cached = neon(url);
  return cached;
}

/** True when a database is configured. Used to gate optional features. */
export function databaseConfigured(): boolean {
  return getSql() !== null;
}
