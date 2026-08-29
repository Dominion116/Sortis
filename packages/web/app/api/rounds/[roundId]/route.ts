import { getRoundEvents } from "@/lib/db/events";
import { getRound } from "@/lib/db/rounds";
import { databaseConfigured } from "@/lib/db/client";
import { poolIds } from "@/lib/draws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public read of one round's indexed trail.
 *
 * DELIBERATELY UNAUTHENTICATED. Everything served here is already public onchain:
 * event arguments the draw engine emitted, and round metadata derived from them.
 * The whole point of `/verify/[roundId]` is that anybody can check a draw without
 * a wallet, so putting a secret in front of its data source would defeat it.
 *
 * No ciphertext handles are returned by this route. Handles live on
 * `/api/prizes/[address]`, which is scoped to one address.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roundId: string }> },
) {
  const { roundId: raw } = await params;

  let roundId: bigint;
  try {
    roundId = BigInt(raw);
  } catch {
    return Response.json({ error: "Invalid round id" }, { status: 400 });
  }
  if (roundId <= 0n) {
    return Response.json({ error: "Invalid round id" }, { status: 400 });
  }

  if (!databaseConfigured()) {
    // The verification page falls back to bounded `getLogs` when this is the
    // answer, so an absent database degrades reach rather than breaking a page.
    return Response.json({ indexed: false, pools: [] });
  }

  try {
    const pools = await Promise.all(
      poolIds.map(async (poolId) => {
        const [round, events] = await Promise.all([
          getRound(poolId, roundId),
          getRoundEvents(poolId, roundId),
        ]);

        return {
          poolId,
          round: round
            ? {
                state: round.state,
                frozenTicketCount: round.frozenTicketCount?.toString(),
                revealedTotal: round.revealedTotal?.toString(),
                revealedRandom: round.revealedRandom?.toString(),
                prizeAmount: round.prizeAmount?.toString(),
                settled: round.settled,
                rolledOver: round.rolledOver,
              }
            : null,
          events: events.map((event) => ({
            name: event.eventName,
            blockNumber: event.blockNumber.toString(),
            txHash: event.txHash,
            args: event.args,
          })),
        };
      }),
    );

    return Response.json({ indexed: true, roundId: roundId.toString(), pools });
  } catch (error) {
    return Response.json(
      { indexed: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
