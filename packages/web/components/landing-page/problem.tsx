import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { MOCK } from "@/lib/mock-data";

const rows = MOCK.problemComparison.rows;

export default function Problem() {
  return (
    <section id="problem" className="container mb-10 space-y-6 py-8 md:py-12 lg:py-24">
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          The problem
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          No-loss prize pools already exist onchain. The mechanism works. It
          just publishes every balance, every payout, forever on a block explorer.
        </p>
      </div>
      <div className="mx-auto grid w-full gap-6 md:max-w-[64rem] md:grid-cols-2">
        <div className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950">
          <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
            {MOCK.problemComparison.publicPoolName}
          </h3>
          <p className="mb-6 text-sm font-normal text-gray-500">
            Illustrative reconstruction of public block-explorer data, not a live screenshot.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                <th className="py-2 font-medium">Address</th>
                <th className="py-2 font-medium">Balance</th>
                <th className="py-2 font-medium">Odds</th>
              </tr>
            </thead>
            <tbody className="tabular font-mono">
              {rows.map((row) => (
                <tr key={row.address} className="border-b border-border/70">
                  <td className="py-3 pr-4 text-muted-foreground">{row.address}</td>
                  <td className="py-3 pr-4 text-foreground">{row.balance}</td>
                  <td className="py-3 text-foreground">{row.odds}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950">
          <h3 className="mb-1 text-lg font-medium text-gray-900 dark:text-gray-100">
            Sortis
          </h3>
          <p className="mb-6 text-sm font-normal text-gray-500">
            Same shared pool. Balances and odds never leave ciphertext.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-[0.06em] text-muted-foreground">
                <th className="py-2 font-medium">Address</th>
                <th className="py-2 font-medium">Balance</th>
                <th className="py-2 font-medium">Odds</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.address} className="border-b border-border/70">
                  <td className="py-3 pr-4 font-mono tabular text-muted-foreground">
                    {row.address}
                  </td>
                  <td className="py-3 pr-4">
                    <CiphertextReveal value={row.balance} size="sm" interactive={false} />
                  </td>
                  <td className="py-3">
                    <CiphertextReveal value={row.odds} size="sm" interactive={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
