"use client";

import { motion } from "framer-motion";
import { CiphertextReveal } from "@/components/ciphertext-reveal";

const BEATS = [
  {
    index: "01",
    title: "Deposit encrypts",
    body: "The amount you deposit is encrypted in your browser before it ever reaches the contract. The chain only ever sees ciphertext.",
  },
  {
    index: "02",
    title: "The pool earns",
    body: "Idle funds route to a yield source. Interest accrues to the shared pool. That part is public, the same as any savings product.",
  },
  {
    index: "03",
    title: "The draw runs over ciphertext",
    body: "At round close, the contract sweeps every encrypted ticket to find a winner without ever decrypting who holds what. Only the winner can decrypt their prize.",
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="container mb-10 space-y-6 rounded-6xl bg-zinc-50 py-8 dark:bg-zinc-900 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          How it works
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Three beats. The last one is the hard part: selecting a winner
          weighted by encrypted balances without decrypting anything.
        </p>
      </div>
      <div className="mx-auto grid w-full gap-6 sm:grid-cols-2 md:max-w-[64rem] md:grid-cols-3">
        {BEATS.map((beat) => (
          <motion.div
            whileHover={{ y: -8 }}
            transition={{ type: "spring", bounce: 0.7 }}
            key={beat.index}
            className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950"
          >
            <div className="mb-2 font-mono text-sm text-gray-500">{beat.index}</div>
            <div className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
              {beat.title}
            </div>
            <div className="mb-6 text-sm font-normal text-gray-500">{beat.body}</div>
            {beat.index === "01" ? (
              <CiphertextReveal value="1,000.00 cUSDT" size="sm" interactive={false} />
            ) : null}
            {beat.index === "02" ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Pool yield, this round
                </span>
                <span className="tabular font-mono text-2xl font-semibold tracking-tight text-foreground">
                  38.14 cUSDT
                </span>
              </div>
            ) : null}
            {beat.index === "03" ? (
              <div className="flex flex-wrap gap-3">
                {["3f9a", "c102", "88e4", "0b7d"].map((seed) => (
                  <CiphertextReveal
                    key={seed}
                    value={seed}
                    size="sm"
                    interactive={false}
                  />
                ))}
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
