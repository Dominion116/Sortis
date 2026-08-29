import { databaseConfigured } from "@/lib/db/client";
import { getSettledRounds } from "@/lib/db/events";
import { poolIds, type PoolId } from "@/lib/draws";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Settled-round history for one pool, from the indexed events.
 *
 * Public: every field is taken from an `ErnieSettled` log. `indexed: false` tells
 * the client to fall back to its own bounded `getLogs` scan, which is the
 * behaviour when no database is configured.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> },
) {
  const { poolId: raw } = await params;

  if (!poolIds.includes(raw as PoolId)) {
    return Response.json({ error: "Unknown pool" }, { status: 400 });
  }
  const poolId = raw as PoolId;

  if (!databaseConfigured()) {
    return Response.json({ indexed: false, rounds: [] });
  }

  try {
    const rounds = await getSettledRounds(poolId);
    return Response.json({
      indexed: true,
      rounds: rounds.map((round) => ({
        roundId: round.roundId,
        prize: round.prize,
        tx: round.txHash,
      })),
    });
  } catch (error) {
    return Response.json(
      { indexed: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
