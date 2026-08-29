"use client";

import * as React from "react";
import { History, Search } from "lucide-react";
import { useAccount, useWalletClient } from "wagmi";

import { EncryptedGate } from "@/components/app/encrypted-gate";
import { useNetworkMismatch } from "@/components/app/network-guard";
import { StatSkeleton } from "@/components/app/skeletons";
import { ContentFade } from "@/components/motion/page-transition";
import { useFhevm } from "@/components/providers/fhevm-provider";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/use-async-action";
import { describeDelta, useRoundHistory, type RoundHistoryEntry } from "@/hooks/use-round-history";
import { formatTokenAmount, sepolia, TOKEN_SYMBOL, type Address } from "@/lib/contracts";
import { getUserDecryptSession } from "@/lib/fhevm/user-decryption";

/**
 * "Did I win round N?" for a past round.
 *
 * `_claimable` is one running encrypted total with no per-user event, so a round
 * result is recovered by decrypting the handle from either side of that round's
 * sweep and subtracting. The keeper records the pair at each boundary; the
 * subtraction happens here, in the browser, under the user's own EIP-712
 * session. The server never sees a plaintext prize.
 *
 * Three outcomes are presented distinctly, and the third matters: when a claim
 * interleaved with the sweep the difference cannot be attributed to the round,
 * and this says so rather than showing a number it cannot stand behind.
 */

type Outcome =
  | { kind: "won"; amount: bigint }
  | { kind: "lost" }
  | { kind: "indeterminate"; reason: string };

export function RoundHistoryCard() {
  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { instance } = useFhevm();
  const wrongNetwork = useNetworkMismatch();
  const { isPending, run } = useAsyncAction();

  const { available, rounds, isLoading } = useRoundHistory(address);
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});

  // Outcomes are scoped to the account, so switching wallets cannot briefly
  // display the previous account's decrypted history.
  const scope = (address ?? "disconnected").toLowerCase();
  const [scopedTo, setScopedTo] = React.useState(scope);
  if (scopedTo !== scope) {
    setScopedTo(scope);
    setOutcomes({});
  }

  async function check(entry: RoundHistoryEntry) {
    if (!address || !instance || !walletClient) return;
    const key = `${entry.poolId}:${entry.roundId}`;

    if (!entry.determinable || !entry.handleBefore || !entry.handleAfter) {
      setOutcomes((prev) => ({
        ...prev,
        [key]: { kind: "indeterminate", reason: entry.reason ?? "This round cannot be checked." },
      }));
      return;
    }

    const pool = sepolia[entry.poolId].pool as Address;
    const contracts = [
      sepolia.token as Address,
      sepolia.demo.pool as Address,
      sepolia.standard.pool as Address,
    ];

    try {
      // Reuses the one session signature already taken this page session.
      const session = await getUserDecryptSession(instance, address, contracts, (request) =>
        walletClient.signTypedData(request as never),
      );
      const result = await instance.userDecrypt(
        [
          { handle: entry.handleBefore, contractAddress: pool },
          { handle: entry.handleAfter, contractAddress: pool },
        ],
        session.privateKey,
        session.publicKey,
        session.signature,
        contracts,
        address,
        session.startTimestamp,
        session.durationDays,
      );

      const valueFor = (handle: string) =>
        result[handle.toLowerCase() as `0x${string}`] ?? result[handle as `0x${string}`];
      const before = valueFor(entry.handleBefore);
      const after = valueFor(entry.handleAfter);

      if (typeof before !== "bigint" || typeof after !== "bigint") {
        throw new Error("The relayer returned an unexpected value.");
      }

      const { won, amount } = describeDelta(before, after);
      setOutcomes((prev) => ({ ...prev, [key]: won ? { kind: "won", amount } : { kind: "lost" } }));
    } catch (error) {
      setOutcomes((prev) => ({
        ...prev,
        [key]: {
          kind: "indeterminate",
          reason:
            error instanceof Error ? error.message.split("\n")[0] : "The check did not complete.",
        },
      }));
    }
  }

  // No database configured is a supported deployment, not an error state. The
  // envelope above still works, so the selector simply does not appear.
  if (!available && !isLoading) return null;

  return (
    <div className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <History className="h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div>
          <h2 className="text-xl font-medium">Past rounds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Check a specific round privately. The result is computed in your
            browser from two encrypted balances, so nobody else learns it.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <StatSkeleton />
          <StatSkeleton />
        </div>
      ) : rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No completed rounds recorded for this wallet yet. Deposit, then check
          back once the round settles.
        </p>
      ) : (
        <ContentFade className="divide-y">
          {rounds.map((entry) => {
            const key = `${entry.poolId}:${entry.roundId}`;
            const outcome = outcomes[key];
            return (
              <div
                key={key}
                className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-mono text-sm">
                    Round {entry.roundId}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {entry.poolId === "demo" ? "demo pool" : "standard pool"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {entry.rolledOver
                      ? "Rolled over: no active ticket held the winning number."
                      : outcome?.kind === "won"
                        ? `You won ${formatTokenAmount(outcome.amount)} ${TOKEN_SYMBOL} in this round.`
                        : outcome?.kind === "lost"
                          ? "Not this round."
                          : outcome?.kind === "indeterminate"
                            ? outcome.reason
                            : entry.determinable
                              ? "Encrypted. Check to reveal privately."
                              : (entry.reason ?? "This round cannot be checked.")}
                  </p>
                </div>
                {!entry.rolledOver && !outcome ? (
                  <EncryptedGate label="round history" className="sm:w-auto">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void run(key, () => check(entry))}
                      loading={isPending(key)}
                      disabled={wrongNetwork || !entry.determinable}
                    >
                      <Search className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                      Check this round
                    </Button>
                  </EncryptedGate>
                ) : null}
              </div>
            );
          })}
        </ContentFade>
      )}
    </div>
  );
}
