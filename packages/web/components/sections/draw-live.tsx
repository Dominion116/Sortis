import { Countdown } from "@/components/countdown";
import { MOCK } from "@/lib/mock-data";

export function DrawLive() {
  const { lastRound } = MOCK;

  return (
    <section id="draw" className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            The draw, live
          </span>
          <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
            A round is always about to resolve.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="flex flex-col justify-center rounded-xl border border-border bg-card p-8 sm:p-10">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Next draw in
            </span>
            <Countdown
              offsetMs={MOCK.nextDrawOffsetMs}
              size="lg"
              className="mt-3"
            />
            <p className="mt-4 max-w-[38ch] text-sm leading-relaxed text-muted-foreground">
              The demo pool runs continuously so there is always a round
              within reach, whatever minute you arrived.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-8 sm:p-10">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              Most recent settled round
            </span>
            <dl className="mt-4 grid grid-cols-2 gap-y-5 text-sm">
              <dt className="text-muted-foreground">Round</dt>
              <dd className="tabular font-mono text-foreground">
                #{lastRound.id}
              </dd>

              <dt className="text-muted-foreground">Prize</dt>
              <dd className="tabular font-mono text-foreground">
                {lastRound.prize}
              </dd>

              <dt className="text-muted-foreground">Settled</dt>
              <dd className="tabular font-mono text-foreground">
                {lastRound.settledAt}
              </dd>

              <dt className="text-muted-foreground">Transaction</dt>
              <dd className="font-mono text-muted-foreground decoration-dotted underline-offset-4">
                {lastRound.txHash.slice(0, 10)}...{lastRound.txHash.slice(-6)}
              </dd>
            </dl>
            <p className="mt-6 text-xs text-muted-foreground">
              Illustrative round data. Live Etherscan links go up once the
              contracts deploy to Sepolia.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
