"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock3, RefreshCw } from "lucide-react";
import { parseEventLogs } from "viem";
import { Countdown } from "@/components/countdown";
import { Button } from "@/components/ui/button";
import { formatTokenAmount, sortisDrawAbi, TOKEN_SYMBOL } from "@/lib/contracts";
import { getDrawAddress, makePublicClient, poolIds, readDrawSnapshot, ROUND_STATES, type PoolId } from "@/lib/draws";

const publicClient = makePublicClient();

async function readHistory(poolId: PoolId) {
  const latest = await publicClient.getBlockNumber();
  const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
  const logs = await publicClient.getLogs({ address: getDrawAddress(poolId), fromBlock } as never);
  return parseEventLogs({ abi: sortisDrawAbi, logs, eventName: "ErnieSettled" }).slice(-8).reverse().map((log) => ({ roundId: String(log.args.roundId), prize: String(log.args.prizeAmount), tx: log.transactionHash ?? "" }));
}

function DrawCard({ poolId }: { poolId: PoolId }) {
  const query = useQuery({ queryKey: ["draw-snapshot", poolId], queryFn: () => readDrawSnapshot(publicClient, poolId), refetchInterval: 5_000 });
  const history = useQuery({ queryKey: ["draw-history", poolId], queryFn: () => readHistory(poolId), refetchInterval: 15_000 });
  const snapshot = query.data;
  const progress = snapshot && snapshot.frozenTicketCount > 0n ? Math.min(100, Number((snapshot.sweepCursor * 100n) / snapshot.frozenTicketCount)) : 0;
  const state = snapshot ? ROUND_STATES[snapshot.state] ?? "Unknown" : "Loading";
  return <article className="space-y-6 rounded-xl border bg-card p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{poolId === "demo" ? "Demo pool" : "Standard pool"}</p><h2 className="mt-2 text-2xl font-medium">Round {snapshot?.roundId.toString() ?? "..."}</h2></div><span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"><Activity className="h-3.5 w-3.5 text-brand" aria-hidden="true" />{state}</span></div>
    {snapshot?.state === 0 ? <div className="flex items-center gap-4 border-y py-4"><Clock3 className="h-5 w-5 text-brand" aria-hidden="true" /><div><p className="text-sm font-medium">Next draw begins in</p>{snapshot ? <Countdown target={new Date(Number(snapshot.roundEndsAt) * 1000)} size="sm" /> : null}</div></div> : null}
    {snapshot?.state === 2 ? <div role="status" className="border-y py-4"><p className="text-sm font-medium">Awaiting oracle</p><p className="mt-1 text-xs text-muted-foreground">The encrypted pool total is being publicly decrypted. The sweep starts as soon as its proof is accepted.</p></div> : null}
    {snapshot?.state === 3 ? <div className="border-y py-4"><div className="flex items-center justify-between text-sm"><span className="font-medium">Encrypted sweep</span><span className="tabular font-mono text-muted-foreground">{snapshot.sweepCursor.toString()} / {snapshot.frozenTicketCount.toString()}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${poolId} sweep progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><div className="sweep-progress h-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">The keeper is processing tickets in encrypted batches.</p></div> : null}
    <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4"><div><dt className="text-xs text-muted-foreground">Prize</dt><dd className="mt-1 font-mono">{snapshot ? `${formatTokenAmount(snapshot.prizeAmount)} ${TOKEN_SYMBOL}` : "..."}</dd></div><div><dt className="text-xs text-muted-foreground">Tickets frozen</dt><dd className="mt-1 font-mono">{snapshot?.frozenTicketCount.toString() ?? "..."}</dd></div><div><dt className="text-xs text-muted-foreground">Total</dt><dd className="mt-1 font-mono">{snapshot && snapshot.revealedTotal > 0n ? snapshot.revealedTotal.toString() : "encrypted"}</dd></div><div><dt className="text-xs text-muted-foreground">Draw engine</dt><dd className="mt-1"><a className="font-mono text-brand hover:underline" href={`https://sepolia.etherscan.io/address/${getDrawAddress(poolId)}`} target="_blank" rel="noreferrer">{getDrawAddress(poolId).slice(0, 6)}...</a></dd></div></dl>
    {query.isError ? <div className="flex items-center justify-between rounded-lg border border-destructive/40 p-3 text-xs"><span>Could not read this pool right now.</span><Button size="sm" variant="ghost" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />Retry</Button></div> : null}
    {history.data?.length ? <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Settled rounds</p><div className="space-y-2">{history.data.map((item) => <a key={item.tx} href={`https://sepolia.etherscan.io/tx/${item.tx}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-md border px-3 py-2 text-xs hover:border-brand"><span>Round {item.roundId}</span><span className="font-mono">{formatTokenAmount(BigInt(item.prize))} {TOKEN_SYMBOL}</span></a>)}</div></div> : null}
  </article>;
}
export function DrawsPanel() { return <section className="section-shell space-y-8"><div className="space-y-3"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">ERNIE draw log</p><h1 className="max-w-3xl font-heading text-4xl tracking-tight md:text-5xl">Watch the prize resolve over ciphertext.</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">Every round freezes its ticket set, publishes a verifiable total, and sweeps in batches. This view follows the same onchain state the keeper uses.</p></div><div className="grid gap-6 lg:grid-cols-2">{poolIds.map((poolId) => <DrawCard key={poolId} poolId={poolId} />)}</div></section>; }
