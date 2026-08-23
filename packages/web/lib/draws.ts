import { createPublicClient, http, type PublicClient } from "viem";
import { sepolia as viemSepolia } from "viem/chains";

import { sepolia, sortisDrawAbi, sortisPoolAbi, type Address } from "@/lib/contracts";

export type PoolId = "demo" | "standard";
export type DrawSnapshot = { poolId: PoolId; roundId: bigint; state: number; openedAt: bigint; closedAt: bigint; frozenTicketCount: bigint; sweepCursor: bigint; revealedTotal: bigint; revealedRandom: bigint; prizeAmount: bigint; roundEndsAt: bigint };
export const poolIds: PoolId[] = ["demo", "standard"];
export function getPoolAddress(id: PoolId): Address { return sepolia[id].pool as Address; }
export function getDrawAddress(id: PoolId): Address { return sepolia[id].draw as Address; }
export function getRpcUrl() { return process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com"; }
export function makePublicClient(): PublicClient { return createPublicClient({ chain: viemSepolia, transport: http(getRpcUrl()) }); }
export async function readDrawSnapshot(client: PublicClient, poolId: PoolId): Promise<DrawSnapshot> {
  const draw = getDrawAddress(poolId); const pool = getPoolAddress(poolId);
  const roundId = await client.readContract({ address: draw, abi: sortisDrawAbi, functionName: "drawingRoundId" });
  const [round, roundEndsAt] = await Promise.all([
    client.readContract({ address: draw, abi: sortisDrawAbi, functionName: "roundAt", args: [roundId] }),
    client.readContract({ address: pool, abi: sortisPoolAbi, functionName: "roundEndsAt" }),
  ]);
  return { poolId, roundId, state: Number(round.state), openedAt: round.openedAt, closedAt: round.closedAt, frozenTicketCount: round.frozenTicketCount, sweepCursor: round.sweepCursor, revealedTotal: round.revealedTotal, revealedRandom: round.revealedRandom, prizeAmount: round.prizeAmount, roundEndsAt };
}
export const ROUND_STATES = ["Open", "Closed", "Awaiting oracle", "Sweeping", "Settled", "Rolled over"] as const;
