"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Eye, Landmark, ShieldCheck } from "lucide-react";
import { parseUnits, toHex } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useWalletClient,
  useWriteContract,
} from "wagmi";

import { ConnectButton } from "@/components/app/connect-button";
import { EncryptedGate } from "@/components/app/encrypted-gate";
import { useNetworkMismatch } from "@/components/app/network-guard";
import { TicketListSkeleton } from "@/components/app/skeletons";
import { ContentFade } from "@/components/motion/page-transition";
import { useFhevm } from "@/components/providers/fhevm-provider";
import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  confidentialUsdtAbi,
  explorerTxUrl,
  formatTokenAmount,
  sepolia,
  SEPOLIA_CHAIN_ID,
  sortisPoolAbi,
  TOKEN_DECIMALS,
  TOKEN_SYMBOL,
  type Address,
} from "@/lib/contracts";
import { getUserDecryptSession } from "@/lib/fhevm/user-decryption";

type PoolId = "demo" | "standard";
type Ticket = {
  id: bigint;
  amountHandle: `0x${string}`;
  activeHandle: `0x${string}`;
  roundId: bigint;
};
type ClearTicket = { amount: bigint; active: boolean };

const MAX_UINT48 = 2 ** 48 - 1;
const MAX_UINT64 = 2n ** 64n - 1n;

function isZeroHandle(handle: string | undefined): boolean {
  return !handle || /^0x0*$/.test(handle);
}

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/User rejected|denied transaction|rejected the request/i.test(message)) {
    return "You rejected the wallet request.";
  }
  if (/insufficient funds/i.test(message)) {
    return "Not enough Sepolia ETH to pay for gas.";
  }
  if (/DepositNotApproved/i.test(message)) {
    return "The token operator approval did not finish. Try the deposit again.";
  }
  return message.split("\n")[0];
}

export function PoolPanel() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { instance } = useFhevm();
  const wrongNetwork = useNetworkMismatch();
  const { writeContractAsync } = useWriteContract();

  // Keyed pending state, not one shared `busy` boolean. Depositing must not
  // grey out the reveal control, and each ticket row needs its own spinner, so
  // withdrawals key on the ticket id. `run` flips the key synchronously, which
  // is what makes the button react on the click rather than a beat later.
  const { isPending, run } = useAsyncAction();

  const [poolId, setPoolId] = React.useState<PoolId>("demo");
  const [amount, setAmount] = React.useState("");
  const [stage, setStage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successHash, setSuccessHash] = React.useState<`0x${string}` | null>(null);
  const [balance, setBalance] = React.useState<bigint | null>(null);
  const [clearTickets, setClearTickets] = React.useState<Record<string, ClearTicket>>({});
  const [revealedScope, setRevealedScope] = React.useState<string | null>(null);
  const [confirmTicket, setConfirmTicket] = React.useState<bigint | null>(null);

  const pool = sepolia[poolId].pool as Address;
  const token = sepolia.token as Address;
  const poolContract = {
    address: pool,
    abi: sortisPoolAbi,
    chainId: SEPOLIA_CHAIN_ID,
  } as const;
  const tokenContract = {
    address: token,
    abi: confidentialUsdtAbi,
    chainId: SEPOLIA_CHAIN_ID,
  } as const;

  const { data: balanceHandle, refetch: refetchBalance } = useReadContract({
    ...poolContract,
    functionName: "balanceHandleOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });
  const { data: ticketCount, refetch: refetchTicketCount } = useReadContract({
    ...poolContract,
    functionName: "ticketCount",
  });
  const { data: nextRound } = useReadContract({
    ...poolContract,
    functionName: "nextEligibleRoundId",
  });
  const { data: operatorApproved, refetch: refetchOperator } = useReadContract({
    ...tokenContract,
    functionName: "isOperator",
    args: address ? [address, pool] : undefined,
    query: { enabled: Boolean(address) },
  });

  const ticketsQuery = useQuery({
    queryKey: ["sortis-tickets", pool, address, ticketCount?.toString()],
    enabled: Boolean(publicClient && address && ticketCount !== undefined),
    queryFn: async (): Promise<Ticket[]> => {
      if (!publicClient || !address || ticketCount === undefined) return [];
      const reads = Array.from({ length: Number(ticketCount) }, async (_, index) => {
        const ticket = await publicClient.readContract({
          address: pool,
          abi: sortisPoolAbi,
          functionName: "ticketAt",
          args: [BigInt(index)],
        });
        if (ticket[0].toLowerCase() !== address.toLowerCase()) return null;
        return {
          id: BigInt(index),
          amountHandle: ticket[1],
          activeHandle: ticket[3],
          roundId: ticket[4],
        } satisfies Ticket;
      });
      return (await Promise.all(reads)).filter((ticket): ticket is Ticket => ticket !== null);
    },
  });
  const tickets = ticketsQuery.data ?? [];

  const currentScope = `${address ?? "disconnected"}:${pool}`.toLowerCase();
  const visibleBalance = revealedScope === currentScope ? balance : null;
  const visibleTickets = revealedScope === currentScope ? clearTickets : {};

  function selectPool(id: PoolId) {
    setPoolId(id);
    setConfirmTicket(null);
    setError(null);
    setStage(null);
  }

  async function waitFor(hash: `0x${string}`) {
    if (!publicClient) throw new Error("Sepolia client is not ready.");
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("The transaction reverted.");
  }

  async function handleDeposit() {
    if (!address || !instance || !publicClient || !amount) return;
    setError(null);
    setSuccessHash(null);
    try {
      const units = parseUnits(amount, TOKEN_DECIMALS);
      if (units <= 0n) throw new Error("Enter an amount greater than zero.");
      if (units > MAX_UINT64) throw new Error("That amount is too large for this pool.");

      setStage("Encrypting the amount in your browser...");
      const encrypted = await instance
        .createEncryptedInput(pool, address)
        .add64(units)
        .encrypt();

      if (!operatorApproved) {
        setStage("Approve this pool as your confidential token operator.");
        const approvalHash = await writeContractAsync({
          ...tokenContract,
          functionName: "setOperator",
          args: [pool, MAX_UINT48],
        });
        await waitFor(approvalHash);
        await refetchOperator();
      }

      setStage("Confirm the encrypted deposit in your wallet.");
      const depositHash = await writeContractAsync({
        ...poolContract,
        functionName: "deposit",
        args: [toHex(encrypted.handles[0]), toHex(encrypted.inputProof)],
      });
      await waitFor(depositHash);
      setSuccessHash(depositHash);
      setAmount("");
      setBalance(null);
      setClearTickets({});
      setRevealedScope(null);
      setStage(`Deposit confirmed. Your ticket is pending for round ${nextRound ?? "the next round"}.`);
      await Promise.all([refetchBalance(), refetchTicketCount(), ticketsQuery.refetch()]);
    } catch (caught) {
      setError(readableError(caught));
      setStage(null);
    }
  }

  async function revealPrivateState(): Promise<void> {
    if (!address || !instance || !walletClient || isZeroHandle(balanceHandle)) return;
    setError(null);
    setStage("Requesting your private balance from the relayer...");
    try {
      const contracts = [
        token,
        sepolia.demo.pool as Address,
        sepolia.standard.pool as Address,
      ];
      const session = await getUserDecryptSession(
        instance,
        address,
        contracts,
        (request) => walletClient.signTypedData(request as never),
      );
      const requested = [
        { handle: balanceHandle!, contractAddress: pool },
        ...tickets.flatMap((ticket) => [
          { handle: ticket.amountHandle, contractAddress: pool },
          { handle: ticket.activeHandle, contractAddress: pool },
        ]),
      ];
      const result = await instance.userDecrypt(
        requested,
        session.privateKey,
        session.publicKey,
        session.signature,
        contracts,
        address,
        session.startTimestamp,
        session.durationDays,
      );
      const valueFor = (handle: string) => result[handle.toLowerCase() as `0x${string}`] ?? result[handle as `0x${string}`];
      const clearBalance = valueFor(balanceHandle!);
      if (typeof clearBalance !== "bigint") throw new Error("The relayer returned an invalid balance.");
      setBalance(clearBalance);
      setClearTickets(Object.fromEntries(tickets.map((ticket) => {
        const ticketAmount = valueFor(ticket.amountHandle);
        const active = valueFor(ticket.activeHandle);
        if (typeof ticketAmount !== "bigint" || typeof active !== "boolean") {
          throw new Error(`The relayer returned invalid data for ticket ${ticket.id}.`);
        }
        return [ticket.id.toString(), { amount: ticketAmount, active }];
      })));
      setRevealedScope(currentScope);
      setStage("Private balance revealed. Further reveals this session need no signature.");
    } catch (caught) {
      setError(readableError(caught));
      setStage(null);
    }
  }

  async function handleWithdraw(ticketId: bigint) {
    setError(null);
    setSuccessHash(null);
    setStage("Confirm the withdrawal in your wallet.");
    try {
      const hash = await writeContractAsync({
        ...poolContract,
        functionName: "withdraw",
        args: [ticketId],
      });
      await waitFor(hash);
      setSuccessHash(hash);
      setConfirmTicket(null);
      setRevealedScope(null);
      setStage("Withdrawal confirmed. The ticket is void and cannot win the in-progress round. Reveal again to refresh the private status; no new signature is needed.");
      await Promise.all([refetchBalance(), ticketsQuery.refetch()]);
    } catch (caught) {
      setError(readableError(caught));
      setStage(null);
    }
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Your pool</p>
          <h1 className="max-w-3xl font-heading text-4xl tracking-tight md:text-5xl">Save privately. Keep your principal.</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">Deposits are encrypted before they leave your browser. Yield funds the prize, while your principal stays withdrawable.</p>
        </div>
        <div className="flex self-start rounded-lg border p-1" role="tablist" aria-label="Choose a pool">
          {(["demo", "standard"] as const).map((id) => (
            <button key={id} type="button" role="tab" aria-selected={poolId === id} onClick={() => selectPool(id)} className={`rounded-md px-3 py-2 text-sm transition-colors ${poolId === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {id === "demo" ? "Demo · 5 min" : "Standard · 24 h"}
            </button>
          ))}
        </div>
      </div>

      {!isConnected ? (
        <div className="rounded-xl border bg-card p-5 sm:p-6"><p className="mb-4 text-sm text-muted-foreground">Connect a Sepolia wallet to deposit, reveal your balance, or withdraw.</p><ConnectButton /></div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-brand" aria-hidden="true" /><h2 className="text-xl font-medium">Deposit {TOKEN_SYMBOL}</h2></div>
              <div className="space-y-2"><label htmlFor="deposit-amount" className="text-sm font-medium">Amount</label><Input id="deposit-amount" inputMode="decimal" placeholder="10.00" value={amount} onChange={(event) => setAmount(event.target.value)} className="font-mono" /></div>
              <p className="text-xs leading-relaxed text-muted-foreground">The first deposit to this pool includes a one-time ERC-7984 operator approval. Your new ticket becomes eligible in round {nextRound?.toString() ?? "the next round"}.</p>
              <EncryptedGate label="deposit encryption" fallback={<div className="h-10 w-40 animate-pulse rounded-md bg-muted" />}><Button onClick={() => void run("deposit", handleDeposit)} loading={isPending("deposit")} disabled={wrongNetwork || amount.length === 0}>Deposit securely</Button></EncryptedGate>
            </div>

            <div className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex items-center gap-3"><Landmark className="h-5 w-5 text-brand" aria-hidden="true" /><h2 className="text-xl font-medium">Private balance</h2></div>
              {visibleBalance === null ? <CiphertextReveal value="•••••••• cUSDT" label="masked by default" interactive={false} /> : <CiphertextReveal key={`${pool}-${visibleBalance}`} value={`${formatTokenAmount(visibleBalance)} ${TOKEN_SYMBOL}`} label="your decrypted principal" />}
              <EncryptedGate label="balance decryption"><Button variant="outline" onClick={() => void run("reveal", revealPrivateState)} loading={isPending("reveal")} disabled={wrongNetwork || isZeroHandle(balanceHandle)}><Eye className="mr-2 h-4 w-4" aria-hidden="true" />Reveal balance</Button></EncryptedGate>
              <p className="text-xs leading-relaxed text-muted-foreground">The first reveal asks for one EIP-712 signature. Its temporary keypair remains only in memory, so later reveals in this browser session need no new signature.</p>
            </div>
          </div>

          <div className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
            <div><h2 className="text-xl font-medium">Your tickets</h2><p className="mt-1 text-sm text-muted-foreground">Withdrawal is available at any time. It returns that ticket&apos;s principal and forfeits its chance in the in-progress round.</p></div>
            {ticketsQuery.isLoading ? (
              <TicketListSkeleton />
            ) : tickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets in this pool yet.</p>
            ) : (
              <ContentFade className="divide-y">
                {tickets.map((ticket) => {
                  const clear = visibleTickets[ticket.id.toString()];
                  const withdrawKey = `withdraw:${ticket.id.toString()}`;
                  const withdrawing = isPending(withdrawKey);
                  return (
                    <div key={ticket.id.toString()} className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                      <div>
                        <p className="font-mono text-sm">Ticket #{ticket.id.toString()}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Round {ticket.roundId.toString()} · {clear ? `${formatTokenAmount(clear.amount)} ${TOKEN_SYMBOL} · ${clear.active ? "active" : "withdrawn"}` : "reveal balance to view private status"}
                        </p>
                      </div>
                      {clear?.active ? (
                        confirmTicket === ticket.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="max-w-xs text-xs text-muted-foreground">This permanently forfeits the ticket from the current draw.</span>
                            <Button size="sm" variant="destructive" onClick={() => void run(withdrawKey, () => handleWithdraw(ticket.id))} loading={withdrawing}>Confirm withdrawal</Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmTicket(null)} disabled={withdrawing}>Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="outline" onClick={() => setConfirmTicket(ticket.id)} disabled={withdrawing}>Withdraw ticket</Button>
                        )
                      ) : null}
                    </div>
                  );
                })}
              </ContentFade>
            )}
          </div>
        </>
      )}

      {stage ? <div role="status" aria-live="polite" className="flex items-start gap-3 rounded-lg border border-brand/40 bg-brand/5 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" /><div><p className="text-sm text-foreground">{stage}</p>{successHash ? <a href={explorerTxUrl(successHash)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block font-mono text-xs text-brand hover:underline">View transaction</a> : null}</div></div> : null}
      {error ? <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-4"><p className="text-sm font-medium">The request did not complete</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{error}</p></div> : null}
    </section>
  );
}
