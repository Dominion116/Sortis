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
    body: "Idle funds route to a yield source. Interest accrues to the shared pool, that part is public, the same as any savings product.",
  },
  {
    index: "03",
    title: "The draw runs over ciphertext",
    body: "At round close, the contract sweeps every encrypted ticket to find a winner without ever decrypting who holds what. Only the winner can decrypt their prize.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            How it works
          </span>
          <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
            Three beats. The middle one is the hard part.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {BEATS.map((beat) => (
            <motion.div
              key={beat.index}
              whileHover={{ y: -6 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="flex flex-col rounded-xl border border-border bg-card p-6"
            >
              <span className="tabular font-mono text-sm text-brand">
                {beat.index}
              </span>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.01em] text-foreground">
                {beat.title}
              </h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {beat.body}
              </p>

              <div className="mt-6 border-t border-border pt-6">
                {beat.index === "01" ? (
                  <CiphertextReveal
                    value="1,000.00 cUSDT"
                    size="sm"
                    interactive={false}
                  />
                ) : null}
                {beat.index === "02" ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      Pool yield, this round
                    </span>
                    <span className="tabular font-mono text-2xl font-semibold tracking-[-0.02em] text-foreground sm:text-3xl">
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
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
