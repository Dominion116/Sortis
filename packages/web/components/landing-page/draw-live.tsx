import { Countdown } from "@/components/countdown";
import { explorerAddressUrl, formatAddress, sepolia } from "@/lib/contracts";
import { MOCK } from "@/lib/mock-data";

export default function DrawLive() {
  const { lastRound } = MOCK;

  return (
    <section id="draw" className="container mb-10 space-y-6 py-8 md:py-12 lg:py-24">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          The draw, live
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          There is always a round on the way to resolving. The demo pool closes
          and settles continuously, which means that whenever you happen to
          arrive, you are never more than a few minutes away from watching a
          complete draw run from start to finish.
        </p>
      </div>
      <div className="mx-auto grid w-full gap-6 md:max-w-[64rem] md:grid-cols-2">
        <div className="relative overflow-hidden rounded-lg border bg-background p-8 dark:bg-zinc-950">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Next draw in
          </span>
          <Countdown offsetMs={MOCK.nextDrawOffsetMs} size="lg" className="mt-3" />
          <p className="mt-4 max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
            {sepolia.demo.pool
              ? "This countdown is still illustrative. The demo pool is live on Sepolia and closes a round every five minutes once the keeper (Phase 10) is running."
              : "This countdown is illustrative until the contracts are deployed. Once they are live, the demo pool will close a round every five minutes and this clock will track it directly."}
          </p>
        </div>
        <div className="relative overflow-hidden rounded-lg border bg-background p-8 dark:bg-zinc-950">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Most recent settled round
          </span>
          <dl className="mt-4 grid grid-cols-2 gap-y-5 text-sm">
            <dt className="text-muted-foreground">Round</dt>
            <dd className="tabular font-mono text-foreground">#{lastRound.id}</dd>
            <dt className="text-muted-foreground">Prize</dt>
            <dd className="tabular font-mono text-foreground">{lastRound.prize}</dd>
            <dt className="text-muted-foreground">Settled</dt>
            <dd className="tabular font-mono text-foreground">{lastRound.settledAt}</dd>
            <dt className="text-muted-foreground">Transaction</dt>
            <dd className="font-mono text-muted-foreground">
              {lastRound.txHash.slice(0, 10)}...{lastRound.txHash.slice(-6)}
            </dd>
          </dl>
          <p className="mt-6 text-xs leading-relaxed text-muted-foreground">
            {sepolia.demo.pool ? (
              <>
                This settled-round card is still illustrative. No keeper has
                closed a round yet. The live demo pool is{" "}
                <a
                  href={explorerAddressUrl(sepolia.demo.pool)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-brand hover:underline"
                >
                  {formatAddress(sepolia.demo.pool)}
                </a>
                .
              </>
            ) : (
              "This round is illustrative. The transaction hash becomes a working Etherscan link as soon as the contracts are deployed to Sepolia."
            )}
          </p>
        </div>
      </div>
    </section>
  );
}
