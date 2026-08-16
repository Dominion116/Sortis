export default function NoLoss() {
  return (
    <section id="no-loss" className="container mb-10 py-8 md:py-12 lg:py-16">
      <div className="rounded-6xl bg-zinc-900 px-6 py-16 text-center text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 sm:px-12 sm:py-24">
        <p className="mx-auto max-w-[24ch] font-heading text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
          Withdraw your principal any time. The only thing at stake is the yield.
        </p>
      </div>
      <div className="mx-auto mt-10 grid max-w-[64rem] gap-6 md:grid-cols-3">
        {[
          {
            label: "Your balance",
            value: "2,481.06",
            note: "principal plus nothing lost",
          },
          {
            label: "Withdraw",
            value: "any time",
            note: "available mid-round",
          },
          {
            label: "Back in your wallet",
            value: "2,481.06",
            note: "same confidential token",
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
            <div className="mt-2 text-sm text-gray-500">{step.note}</div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-[60ch] text-center text-sm leading-relaxed text-muted-foreground">
        Withdrawing mid-round voids that round&apos;s ticket. You keep every
        cent of principal, you just forfeit that round&apos;s entry. Nothing is
        locked, ever.
      </p>
    </section>
  );
}
