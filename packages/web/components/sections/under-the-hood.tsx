import { MOCK } from "@/lib/mock-data";

const FACTS = [
  { label: "Encryption", value: "Zama Protocol, fully homomorphic encryption" },
  { label: "Token standard", value: "ERC-7984 confidential tokens (OpenZeppelin)" },
  { label: "Network", value: "Ethereum Sepolia" },
  { label: "Contracts", value: "SortisPool, SortisDraw (“ERNIE”), SortisFaucet" },
];

const ADDRESSES = [
  { label: "SortisPool", value: MOCK.deployedAddresses.pool },
  { label: "SortisDraw", value: MOCK.deployedAddresses.draw },
  { label: "SortisFaucet", value: MOCK.deployedAddresses.faucet },
  { label: "Confidential token (cUSDT)", value: MOCK.deployedAddresses.token },
];

export function UnderTheHood() {
  return (
    <section
      id="under-the-hood"
      className="border-t border-border bg-muted/30 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            Under the hood
          </span>
          <h2 className="mt-3 font-heading text-3xl font-semibold leading-tight tracking-[-0.02em] text-foreground sm:text-4xl">
            Built on primitives that are audited, not bespoke.
          </h2>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Stack
            </h3>
            <dl className="mt-4 divide-y divide-border border-t border-border">
              {FACTS.map((fact) => (
                <div
                  key={fact.label}
                  className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm"
                >
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="text-foreground">{fact.value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
                <dt className="text-muted-foreground">Test coverage</dt>
                <dd className="tabular font-mono text-foreground">
                  {MOCK.coverage}{" "}
                  <span className="font-sans text-xs text-muted-foreground">
                    (lands with the contract suite)
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
                <dt className="text-muted-foreground">Repository</dt>
                <dd>
                  <a
                    href={MOCK.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brand underline decoration-border underline-offset-4 hover:decoration-brand"
                  >
                    github.com/Dominion116/sortis
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Deployed contracts
            </h3>
            <dl className="mt-4 divide-y divide-border border-t border-border">
              {ADDRESSES.map((addr) => (
                <div
                  key={addr.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 text-sm"
                >
                  <dt className="text-foreground">{addr.label}</dt>
                  <dd className="font-mono text-xs text-muted-foreground">
                    {addr.value ?? "pending deployment"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Addresses go live with the Sepolia deployment (Phase 7) and are
              verified on Etherscan.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
