import { CiphertextReveal } from "@/components/ciphertext-reveal";
import { MOCK } from "@/lib/mock-data";

const rows = MOCK.problemComparison.rows;

export function Problem() {
  return (
    <section className="border-b border-line bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-mute">
            The problem
          </span>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Every balance, every payout, forever on a block explorer.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-ink/80">
            No-loss prize pools already exist onchain. The mechanism works —
            it just gives up the one thing savers quietly care about.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2">
          <div className="bg-white p-6 sm:p-8">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
              {MOCK.problemComparison.publicPoolName}
            </h3>
            <p className="mt-1 text-xs text-mute">
              Illustrative reconstruction of public block-explorer data — not
              a live screenshot.
            </p>
            <table className="mt-6 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-mute">
                  <th className="py-2 font-medium">Address</th>
                  <th className="py-2 font-medium">Balance</th>
                  <th className="py-2 font-medium">Odds</th>
                </tr>
              </thead>
              <tbody className="tabular font-mono">
                {rows.map((row) => (
                  <tr key={row.address} className="border-b border-line/70">
                    <td className="py-3 pr-4 text-ink/80">{row.address}</td>
                    <td className="py-3 pr-4 text-ink">{row.balance}</td>
                    <td className="py-3 text-ink">{row.odds}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white p-6 sm:p-8">
            <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
              Sortis
            </h3>
            <p className="mt-1 text-xs text-mute">
              Same shared pool. Balances and odds never leave ciphertext.
            </p>
            <table className="mt-6 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-mute">
                  <th className="py-2 font-medium">Address</th>
                  <th className="py-2 font-medium">Balance</th>
                  <th className="py-2 font-medium">Odds</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.address} className="border-b border-line/70">
                    <td className="py-3 pr-4 font-mono text-ink/80 tabular">
                      {row.address}
                    </td>
                    <td className="py-3 pr-4">
                      <CiphertextReveal
                        value={row.balance}
                        size="sm"
                        interactive={false}
                      />
                    </td>
                    <td className="py-3">
                      <CiphertextReveal
                        value={row.odds}
                        size="sm"
                        interactive={false}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
