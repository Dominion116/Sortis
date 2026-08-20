import { MOCK } from "@/lib/mock-data";

export default function NoLoss() {
  return (
    <section id="no-loss" className="container mb-10 py-8 md:py-12 lg:py-16">
      <div className="rounded-6xl bg-zinc-900 px-6 py-16 text-center text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 sm:px-12 sm:py-24">
        <p className="mx-auto max-w-[26ch] font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          You can withdraw every cent of your principal at any time.
        </p>
        <p className="mx-auto mt-6 max-w-[52ch] text-base leading-relaxed text-zinc-300 dark:text-zinc-600 sm:text-lg">
          The only thing you ever put at stake is the interest, and that is what
          the prize is made of.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-[64rem] gap-6 md:grid-cols-3">
        {[
          {
            label: "What you deposited",
            value: MOCK.myBalance,
            note: "Held as a confidential token, readable only by you.",
          },
          {
            label: "When you can withdraw",
            value: "Any time",
            note: "Including partway through a round that has already opened.",
          },
          {
            label: "What returns to your wallet",
            value: MOCK.myBalance,
            note: "The same token, the same amount, with nothing deducted.",
          },
        ].map((step) => (
          <div
            key={step.label}
            className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950"
          >
            <div className="mb-2 text-sm text-muted-foreground">{step.label}</div>
            <div className="tabular font-mono text-2xl font-semibold tracking-tight">
              {step.value}
            </div>
            <div className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.note}
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[68ch] text-center text-sm leading-relaxed text-muted-foreground">
        Withdrawing in the middle of a round does void your ticket for that
        round, so you give up the entry you had already earned. What you do not
        give up is any part of your principal, and nothing about the pool ever
        locks your money in place.
      </p>
    </section>
  );
}
