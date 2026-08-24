import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";

import { explorerAddressUrl, formatAddress, sepolia } from "@/lib/contracts";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How Sortis works",
  description: "The encrypted ticket model, public draw proof, and live Sortis contracts.",
};

const steps = [
  ["01", "Deposit privately", "Your browser encrypts the amount before the ERC-7984 transfer. The pool records a ticket range, but no participant amount is readable."],
  ["02", "Earn as one pool", "Deposits stay withdrawable principal. Idle funds earn yield together, and only that yield becomes the round prize."],
  ["03", "Verify the draw", "The total, random value, sweep, and settlement are published as events. Anyone can inspect the trail without a wallet."],
] as const;

const contracts = [
  ["Confidential token", sepolia.token],
  ["Faucet", sepolia.faucet],
  ["Demo pool", sepolia.demo.pool],
  ["Demo draw", sepolia.demo.draw],
  ["Standard pool", sepolia.standard.pool],
  ["Standard draw", sepolia.standard.draw],
] as const;

export default function HowItWorksPage() {
  return <main className="section-shell space-y-12">
    <div className="space-y-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Protocol guide</p><h1 className="max-w-3xl font-heading text-4xl tracking-tight md:text-6xl">How Sortis works</h1><p className="max-w-2xl text-base leading-7 text-muted-foreground">A no-loss prize pool built on encrypted balances. The contracts are live on Ethereum Sepolia and the draw trail is public.</p></div>
    <div className="grid gap-6 md:grid-cols-3">{steps.map(([number, title, body]) => <article key={number} className="space-y-4 border-t pt-5"><span className="font-mono text-sm text-muted-foreground">{number}</span><h2 className="text-xl font-medium">{title}</h2><p className="text-sm leading-7 text-muted-foreground">{body}</p></article>)}</div>
    <section className="space-y-6 border-y py-8"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Live deployment</p><h2 className="mt-2 text-2xl font-medium">Verified Sepolia contracts</h2></div><dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">{contracts.map(([label, address]) => <div key={label} className="flex items-center justify-between gap-4 border-b pb-3 text-sm"><dt>{label}</dt><dd><a className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline" href={explorerAddressUrl(address)} target="_blank" rel="noreferrer" title={address}>{formatAddress(address)}<ExternalLink className="h-3 w-3" aria-hidden="true" /></a></dd></div>)}</dl><p className="text-sm text-muted-foreground">Contract tests cover 97.1% of Solidity statements against the FHEVM mock coprocessor. Read the source in <a className="text-brand hover:underline" href={siteConfig.links.github} target="_blank" rel="noreferrer">the repository</a>.</p></section>
    <div className="flex flex-wrap gap-3"><Link href="/pool" className={cn(buttonVariants({ size: "lg" }))}>Open the pool <ArrowRight className="ml-2 h-4 w-4" /></Link><Link href="/app/draws" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>Watch live draws</Link></div>
  </main>;
}
