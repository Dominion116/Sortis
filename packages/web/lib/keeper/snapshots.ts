import { getAbiItem, toFunctionSelector, type AbiFunction, type PublicClient } from "viem";

import { sortisPoolAbi } from "@/lib/contracts";
import { getPoolAddress, type PoolId } from "@/lib/draws";

/**
 * Participant discovery and handle capture for one round.
 *
 * WHY THIS RUNS INSIDE THE KEEPER
 *
 * The keeper is the process that calls `closeRound` and `settle`, so it is
 * standing exactly at both round boundaries. Capturing handles here means both
 * reads happen against the chain head, in the same invocation as the
 * transaction that creates the boundary. Reconstructing the same information
 * later would require historical `eth_call` depth, which public Sepolia RPCs do
 * not reliably provide.
 *
 * Participation is public by design (see the ticket model in SortisPool), so
 * reading owners from `ticketAt` leaks nothing. Amounts and outcomes stay
 * encrypted.
 */

/** Distinct owners of the frozen ticket prefix, which is the eligible set. */
export async function frozenParticipants(
  client: PublicClient,
  poolId: PoolId,
  frozenTicketCount: bigint,
): Promise<string[]> {
  const pool = getPoolAddress(poolId);
  const count = Number(frozenTicketCount);
  if (count === 0) return [];

  const owners = await Promise.all(
    Array.from({ length: count }, async (_, index) => {
      const ticket = await client.readContract({
        address: pool,
        abi: sortisPoolAbi,
        functionName: "ticketAt",
        args: [BigInt(index)],
      });
      return ticket[0].toLowerCase();
    }),
  );

  return [...new Set(owners)];
}

/**
 * Current `_claimable` handle for each address.
 *
 * A zero handle means the address has never been credited. It is recorded as
 * such rather than skipped, because "was zero before the round" is exactly the
 * baseline a first-time winner's delta needs.
 */
export async function readClaimableHandles(
  client: PublicClient,
  poolId: PoolId,
  addresses: string[],
): Promise<{ address: string; handle: string }[]> {
  const pool = getPoolAddress(poolId);

  return Promise.all(
    addresses.map(async (address) => {
      const handle = await client.readContract({
        address: pool,
        abi: sortisPoolAbi,
        functionName: "claimableHandleOf",
        args: [address as `0x${string}`],
      });
      return { address, handle: handle as string };
    }),
  );
}

/**
 * Did anyone claim inside this block range?
 *
 * `SortisPool.claim` emits no event, so this is the only way to detect a claim
 * that interleaved with a sweep. An interleaved claim decrements `_claimable`
 * partway through the window, which makes the handle delta uninterpretable:
 * the round has to report as indeterminate instead of showing a wrong figure.
 *
 * Sweep windows are a handful of blocks, so scanning them by transaction is
 * cheap. The selector is derived from the generated ABI rather than hardcoded,
 * so a signature change cannot silently stop the detection working.
 */
const claimSelector = toFunctionSelector(
  getAbiItem({ abi: sortisPoolAbi, name: "claim" }) as AbiFunction,
);

export async function claimInterleaved(
  client: PublicClient,
  poolId: PoolId,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<boolean> {
  const pool = getPoolAddress(poolId).toLowerCase();

  // Guard against a nonsensical or unexpectedly wide range rather than walking
  // a large part of the chain block by block.
  if (toBlock < fromBlock) return false;
  if (toBlock - fromBlock > 200n) return false;

  for (let block = fromBlock; block <= toBlock; block += 1n) {
    const full = await client.getBlock({ blockNumber: block, includeTransactions: true });
    for (const tx of full.transactions) {
      if (typeof tx === "string") continue;
      if ((tx.to ?? "").toLowerCase() !== pool) continue;
      if (tx.input.startsWith(claimSelector)) return true;
    }
  }

  return false;
}
