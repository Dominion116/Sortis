import { MOCK } from "@/lib/mock-data";

export default function NoLoss() {
  return (
    <section id="no-loss" className="section-shell">
      <div className="rounded-3xl bg-zinc-900 px-5 py-14 text-center text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 sm:px-12 sm:py-20">
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
            className="relative overflow-hidden rounded-xl border bg-card p-5 sm:p-6"
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
      <p className="mx-auto mt-8 max-w-[68ch] text-center text-sm leading-6 text-muted-foreground">
        A mid-round withdrawal voids that round&apos;s ticket, but never locks or
        reduces your principal.
      </p>
    </section>
  );
}
