import { Countdown } from "@/components/countdown";
import { Stat } from "@/components/stat";
import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { MOCK } from "@/lib/mock-data";

export function Hero() {
  return (
    <section className="relative border-b border-line bg-white pt-16 sm:pt-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="inline-block border border-line px-3 py-1 text-xs uppercase tracking-[0.08em] text-mute">
            Zama Developer Program — Mainnet Season 4, Bounty Track
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-[-0.02em] text-ink sm:text-6xl">
            Save together. One winner takes the yield. Nobody sees who has
            what.
          </h1>
          <p className="mt-6 max-w-[58ch] text-lg leading-relaxed text-ink/80">
            Sortis is a no-loss prize savings pool on the Zama Protocol.
            Deposit a confidential token, keep your principal forever, and
            let the pool&apos;s yield fund one encrypted prize draw per round
            — settled entirely over ciphertext.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4 pb-16 sm:pb-24">
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center bg-ink px-6 text-[15px] font-semibold tracking-[-0.01em] text-white transition-colors hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              See how it works
            </a>
            <a
              href="#draw"
              className="inline-flex h-11 items-center border border-ink px-6 text-[15px] font-semibold tracking-[-0.01em] text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Watch the draw
            </a>
          </div>
        </div>
      </div>

      {/* Grid-breaking moment: the stat strip bleeds wider than the text column above it. */}
      <div className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-y divide-line px-6 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
          <div className="py-8 sm:px-8">
            <Stat
              label="Total pooled"
              value={MOCK.totalPooled}
              sublabel="publicly verifiable"
            />
          </div>
          <div className="py-8 sm:px-8">
            <span className="text-xs uppercase tracking-[0.08em] text-mute">
              Next draw
            </span>
            <Countdown
              offsetMs={MOCK.nextDrawOffsetMs}
              size="sm"
              className="mt-1.5"
            />
          </div>
          <div className="py-8 sm:px-8">
            <Stat
              label="Participants"
              value={MOCK.participantCount}
              sublabel="this round"
            />
          </div>
          <div className="py-8 sm:px-8">
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
