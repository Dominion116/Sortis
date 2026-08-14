import { Countdown } from "@/components/countdown";
import { Stat } from "@/components/stat";
import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { MOCK } from "@/lib/mock-data";

export function Hero() {
  return (
    <section className="relative pt-12 sm:pt-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Zama Developer Program, Mainnet Season 4, Bounty Track
          </span>
          <h1 className="mt-6 font-heading text-5xl font-semibold leading-[1.05] tracking-[-0.02em] text-foreground sm:text-6xl">
            Save together. One winner takes the yield. Nobody sees who has
            what.
          </h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-muted-foreground">
            Sortis is a no-loss prize savings pool on the Zama Protocol.
            Deposit a confidential token, keep your principal forever, and
            let the pool&apos;s yield fund one encrypted prize draw per
            round, settled entirely over ciphertext.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4 pb-16 sm:pb-24">
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[15px] font-semibold tracking-[-0.01em] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              See how it works
            </a>
            <a
              href="#draw"
              className="inline-flex h-11 items-center rounded-full border border-primary px-6 text-[15px] font-semibold tracking-[-0.01em] text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Watch the draw
            </a>
          </div>
        </div>
      </div>

      {/* Grid-breaking moment: the stat strip bleeds wider than the text column above it. */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <Stat
              label="Total pooled"
              value={MOCK.totalPooled}
              sublabel="publicly verifiable"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Next draw
            </span>
            <Countdown
              offsetMs={MOCK.nextDrawOffsetMs}
              size="sm"
              className="mt-1.5"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <Stat
              label="Participants"
              value={MOCK.participantCount}
              sublabel="this round"
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <CiphertextReveal
              label="Example balance"
              value={MOCK.myBalance}
              size="sm"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
