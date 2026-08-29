import { parseAbiItem, type PublicClient } from "viem";

import { getRoundEvents } from "@/lib/db/events";
import { getRound } from "@/lib/db/rounds";
import { databaseConfigured } from "@/lib/db/client";
import { getDrawAddress, makePublicClient, poolIds, type PoolId } from "@/lib/draws";

export const verificationEvents = {
  closed: parseAbiItem("event ErnieRoundClosed(uint64 indexed roundId, uint256 frozenTicketCount, uint64 closedAt)"),
  total: parseAbiItem("event ErnieTotalRevealed(uint64 indexed roundId, uint64 total)"),
  random: parseAbiItem("event ErnieRandomDrawn(uint64 indexed roundId, uint64 randomValue, uint64 total)"),
  settled: parseAbiItem("event ErnieSettled(uint64 indexed roundId, uint64 prizeAmount, uint64 randomValue)"),
  rollover: parseAbiItem("event ErnieRolledOver(uint64 indexed roundId, uint64 carriedPrize)"),
};

export type VerificationTrail = { poolId: PoolId; frozenTicketCount?: bigint; total?: bigint; random?: bigint; prize?: bigint; carriedPrize?: bigint; closedAt?: bigint; settled: boolean; rolledOver: boolean };

/**
 * Read one round's public trail.
 *
 * Prefers the indexed tables, which cover every round since deployment. Falls
 * back to a bounded `getLogs` scan when no database is configured, or when the
 * indexer has not reached this round yet. That bound exists because public
 * Sepolia RPCs reject wide ranges, and removing it is one of the reasons the
 * indexer is worth having.
 */
export async function readVerification(roundId: bigint, client: PublicClient = makePublicClient()): Promise<VerificationTrail[]> {
  if (databaseConfigured()) {
    try {
      const indexed = await readVerificationIndexed(roundId);
      if (indexed) return indexed;
    } catch {
      // Fall through to logs rather than failing the page on a database issue.
    }
  }

  return readVerificationFromLogs(roundId, client);
}

/** Indexed path. Returns null when this round is not in the database yet. */
async function readVerificationIndexed(roundId: bigint): Promise<VerificationTrail[] | null> {
  const trails = await Promise.all(
    poolIds.map(async (poolId): Promise<VerificationTrail | null> => {
      const [round, events] = await Promise.all([
        getRound(poolId, roundId),
        getRoundEvents(poolId, roundId),
      ]);
      if (!round && events.length === 0) return null;

      const arg = (name: string, field: string): bigint | undefined => {
        const event = events.find((entry) => entry.eventName === name);
        const value = event?.args[field];
        return value === undefined ? undefined : BigInt(value);
      };

      return {
        poolId,
        frozenTicketCount: round?.frozenTicketCount ?? arg("ErnieRoundClosed", "frozenTicketCount"),
        closedAt: arg("ErnieRoundClosed", "closedAt"),
        total: round?.revealedTotal ?? arg("ErnieTotalRevealed", "total"),
        random: round?.revealedRandom ?? arg("ErnieSettled", "randomValue") ?? arg("ErnieRandomDrawn", "randomValue"),
        prize: arg("ErnieSettled", "prizeAmount"),
        carriedPrize: arg("ErnieRolledOver", "carriedPrize"),
        settled: round?.settled ?? events.some((entry) => entry.eventName === "ErnieSettled"),
        rolledOver: round?.rolledOver ?? events.some((entry) => entry.eventName === "ErnieRolledOver"),
      };
    }),
  );

  // If neither pool has this round indexed the indexer is simply behind. Let the
  // caller fall back rather than rendering an empty trail as though it were fact.
  if (trails.every((trail) => trail === null)) return null;

  return poolIds.map((poolId, index) => trails[index] ?? { poolId, settled: false, rolledOver: false });
}

/** Original log-scan path, bounded to the latest 100,000 blocks. */
async function readVerificationFromLogs(roundId: bigint, client: PublicClient): Promise<VerificationTrail[]> {
  const latest = await client.getBlockNumber();
  const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
  return Promise.all(poolIds.map(async (poolId) => {
    const address = getDrawAddress(poolId);
    const [closed, total, random, settled, rollover] = await Promise.all([
      client.getLogs({ address, event: verificationEvents.closed, args: { roundId }, fromBlock, toBlock: latest }),
      client.getLogs({ address, event: verificationEvents.total, args: { roundId }, fromBlock, toBlock: latest }),
      client.getLogs({ address, event: verificationEvents.random, args: { roundId }, fromBlock, toBlock: latest }),
      client.getLogs({ address, event: verificationEvents.settled, args: { roundId }, fromBlock, toBlock: latest }),
      client.getLogs({ address, event: verificationEvents.rollover, args: { roundId }, fromBlock, toBlock: latest }),
    ]);
    const c = closed[0]?.args; const t = total[0]?.args; const r = random[0]?.args; const s = settled[0]?.args; const o = rollover[0]?.args;
    return { poolId, frozenTicketCount: c?.frozenTicketCount, closedAt: c?.closedAt, total: t?.total, random: s?.randomValue ?? r?.randomValue, prize: s?.prizeAmount, carriedPrize: o?.carriedPrize, settled: settled.length > 0, rolledOver: rollover.length > 0 };
  }));
}
