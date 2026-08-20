"use client";

import { motion } from "framer-motion";
import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { MOCK } from "@/lib/mock-data";

const BEATS = [
  {
    index: "01",
    title: "Your deposit is encrypted before it leaves your browser",
    body: "You choose an amount and your browser encrypts it locally, producing a sealed value and a proof that the value is well formed. The contract accepts both and records a ticket it can compute against but never read.",
  },
  {
    index: "02",
    title: "The pool earns interest as a single balance",
    body: "Funds sitting in the pool are routed to a yield source, and the interest accumulates against the pool as a whole rather than against any one saver. This total is public on purpose, because it is the prize everyone is playing for.",
  },
  {
    index: "03",
    title: "The winner is chosen without decrypting anyone",
    body: "When the round closes, the contract draws a random value and walks the encrypted ticket list to find which ticket that value falls inside. It never learns whose ticket it landed on, and only the winner holds the key to decrypt what they won.",
  },
] as const;

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="container mb-10 space-y-6 rounded-6xl bg-zinc-100 py-8 dark:bg-zinc-900 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          How it works
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          The whole protocol comes down to three steps, and the third is where
          the genuinely difficult engineering lives. Choosing a winner weighted
          by everyone&apos;s balance, while none of those balances can be read,
          is the problem Sortis exists to solve.
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
            <div className="mb-2 font-mono text-sm text-muted-foreground">{beat.index}</div>
            <div className="mb-2 text-lg font-medium text-foreground">
              {beat.title}
            </div>
            <div className="mb-6 text-sm font-normal text-muted-foreground">{beat.body}</div>
            {beat.index === "01" ? (
              <CiphertextReveal value="1,000.00 cUSDT" size="sm" interactive={false} />
            ) : null}
            {beat.index === "02" ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  Pool yield, this round
                </span>
                <span className="tabular font-mono text-2xl font-semibold tracking-tight text-foreground">
                  {MOCK.lastRound.prize}
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
