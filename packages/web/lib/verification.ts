import { parseAbiItem, type PublicClient } from "viem";

import { getDrawAddress, makePublicClient, poolIds, type PoolId } from "@/lib/draws";

export const verificationEvents = {
  closed: parseAbiItem("event ErnieRoundClosed(uint64 indexed roundId, uint256 frozenTicketCount, uint64 closedAt)"),
  total: parseAbiItem("event ErnieTotalRevealed(uint64 indexed roundId, uint64 total)"),
  random: parseAbiItem("event ErnieRandomDrawn(uint64 indexed roundId, uint64 randomValue, uint64 total)"),
  settled: parseAbiItem("event ErnieSettled(uint64 indexed roundId, uint64 prizeAmount, uint64 randomValue)"),
  rollover: parseAbiItem("event ErnieRolledOver(uint64 indexed roundId, uint64 carriedPrize)"),
};

export type VerificationTrail = { poolId: PoolId; frozenTicketCount?: bigint; total?: bigint; random?: bigint; prize?: bigint; carriedPrize?: bigint; closedAt?: bigint; settled: boolean; rolledOver: boolean };

export async function readVerification(roundId: bigint, client: PublicClient = makePublicClient()): Promise<VerificationTrail[]> {
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
