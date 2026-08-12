import { ArrowRight } from "lucide-react";

const STEPS = [
  { label: "Your balance", value: "2,481.06", note: "principal + nothing lost" },
  { label: "Withdraw", value: "→", note: "available mid-round, any time" },
  { label: "Back in your wallet", value: "2,481.06", note: "same confidential token" },
];

export function NoLoss() {
  return (
    <section className="border-b border-line">
      <div className="bg-sortis-red px-6 py-20 text-center sm:py-28">
        <p className="mx-auto max-w-[24ch] text-4xl font-bold leading-[1.1] tracking-[-0.02em] text-white sm:text-5xl">
          Withdraw your principal any time. The only thing at stake is the
          yield.
        </p>
      </div>

      <div className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <span className="text-xs uppercase tracking-[0.08em] text-mute">
            The withdrawal path
          </span>
          <div className="mt-8 grid grid-cols-1 items-center gap-8 sm:grid-cols-[1fr_auto_1fr_auto_1fr]">
            {STEPS.map((step, i) => (
              <div key={step.label} className="contents">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs uppercase tracking-[0.08em] text-mute">
                    {step.label}
                  </span>
                  <span className="tabular font-mono text-2xl font-semibold tracking-[-0.02em] text-ink">
                    {step.value}
                  </span>
                  <span className="text-sm text-mute">{step.note}</span>
                </div>
                {i < STEPS.length - 1 ? (
                  <ArrowRight
                    className="hidden h-5 w-5 text-line sm:block"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[60ch] text-sm leading-relaxed text-mute">
            Withdrawing mid-round voids that round&apos;s ticket — you keep
            every cent of principal, you just forfeit that round&apos;s
            entry. Nothing is locked, ever.
          </p>
        </div>
      </div>
    </section>
  );
}
