import { isAddress } from "viem";

import { databaseConfigured } from "@/lib/db/client";
import { listRoundsForAddress } from "@/lib/db/rounds";
import { getHandlePair } from "@/lib/db/snapshots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Per-round ciphertext handle pairs for one address.
 *
 * DELIBERATELY UNAUTHENTICATED, and safe because of what a handle is. The pool
 * grants decryption of a `_claimable` handle to its owning address only, so a
 * handle served here is inert to anybody else: without that address's EIP-712
 * authorisation the relayer refuses to decrypt it. There is a contract test
 * (`ClaimableHistory`) pinning that a non-owner cannot decrypt one.
 *
 * The privacy boundary therefore stays exactly where the protocol puts it. This
 * route never returns a plaintext amount, and the server never holds a
 * decryption session.
 *
 * What it does leak, and what was already public: that an address took part in a
 * given round. Participation is public by design in the ticket model, readable
 * from `ticketAt` and from the `Deposited` event.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address: raw } = await params;

  if (!isAddress(raw)) {
    return Response.json({ error: "Invalid address" }, { status: 400 });
  }
  const address = raw.toLowerCase();

  if (!databaseConfigured()) {
    // The prizes screen hides its round selector on this answer and keeps the
    // current-balance reveal, which needs no history.
    return Response.json({ indexed: false, rounds: [] });
  }

  try {
    const rounds = await listRoundsForAddress(address);

    const withHandles = await Promise.all(
      rounds.map(async (round) => {
        const pair = await getHandlePair(round.poolId, round.roundId, address);

        // Both boundaries are required for a delta to mean anything, and an
        // interleaved claim invalidates it outright. Saying so explicitly is
        // better than returning a number that looks authoritative.
        const determinable =
          Boolean(pair?.handleBefore) && Boolean(pair?.handleAfter) && !round.deltaUnreliable;

        return {
          poolId: round.poolId,
          roundId: round.roundId.toString(),
          prizeAmount: round.prizeAmount?.toString(),
          settled: round.settled,
          rolledOver: round.rolledOver,
          determinable,
          reason: round.deltaUnreliable
            ? "A claim transaction landed inside this round's sweep, so the encrypted difference cannot be attributed to this round."
            : !pair?.handleBefore || !pair?.handleAfter
              ? "This round was not fully recorded, so there is no reliable pair to compare."
              : undefined,
          handleBefore: determinable ? pair?.handleBefore : undefined,
          handleAfter: determinable ? pair?.handleAfter : undefined,
        };
      }),
    );

    return Response.json({ indexed: true, address, rounds: withHandles });
  } catch (error) {
    return Response.json(
      { indexed: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
