"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import type { PoolId } from "@/lib/draws";

/**
 * Per-round prize history for the connected address.
 *
 * The server supplies only ciphertext handles. Decryption happens in the browser
 * with the user's own EIP-712 session, so the backend never sees a plaintext
 * prize. `determinable` is the server's judgement about whether the pair can be
 * compared at all; when it is false the UI must show the reason rather than a
 * number.
 */

export interface RoundHistoryEntry {
  poolId: PoolId;
  roundId: string;
  prizeAmount?: string;
  settled: boolean;
  rolledOver: boolean;
  determinable: boolean;
  reason?: string;
  handleBefore?: string;
  handleAfter?: string;
}

interface HistoryResponse {
  indexed: boolean;
  rounds: RoundHistoryEntry[];
}

/**
 * Fetch the address's indexed round list.
 *
 * `indexed: false` means no database is configured, which is a supported
 * deployment. Callers hide the round selector in that case instead of showing an
 * error, because nothing is broken: the current-balance reveal still works.
 */
export function useRoundHistory(address?: `0x${string}`) {
  const query = useQuery<HistoryResponse>({
    queryKey: ["prize-history", address],
    enabled: Boolean(address),
    queryFn: async () => {
      const response = await fetch(`/api/prizes/${address}`);
      if (!response.ok) throw new Error("Could not load your round history.");
      return (await response.json()) as HistoryResponse;
    },
    staleTime: 30_000,
  });

  return {
    available: query.data?.indexed === true,
    rounds: query.data?.rounds ?? [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

/** Formats the plaintext outcome of one decrypted handle pair. */
export function describeDelta(before: bigint, after: bigint): {
  won: boolean;
  amount: bigint;
} {
  // The sweep credits `select(hit, prize, 0)`, so a loser's total is unchanged
  // and a winner's grows by exactly the prize. A negative difference would mean
  // a claim interleaved, which the server should already have flagged; treating
  // it as "not won" rather than showing a negative prize is the safe reading.
  const delta = after > before ? after - before : 0n;
  return { won: delta > 0n, amount: delta };
}
