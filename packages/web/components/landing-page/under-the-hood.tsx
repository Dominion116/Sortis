import { MOCK } from "@/lib/mock-data";

const FACTS = [
  { label: "Encryption", value: "Zama Protocol, fully homomorphic encryption" },
  { label: "Token standard", value: "ERC-7984 confidential tokens (OpenZeppelin)" },
  { label: "Network", value: "Ethereum Sepolia" },
  { label: "Contracts", value: "SortisPool, SortisDraw (ERNIE), SortisFaucet" },
];

const ADDRESSES = [
  { label: "SortisPool", value: MOCK.deployedAddresses.pool },
  { label: "SortisDraw", value: MOCK.deployedAddresses.draw },
  { label: "SortisFaucet", value: MOCK.deployedAddresses.faucet },
  { label: "Confidential token (cUSDT)", value: MOCK.deployedAddresses.token },
];

export default function UnderTheHood() {
  return (
    <section
      id="under-the-hood"
      className="container mb-10 space-y-6 rounded-6xl bg-zinc-50 py-8 dark:bg-zinc-900 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          Under the hood
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Built on primitives that are audited, not bespoke.
        </p>
      </div>
      <div className="mx-auto grid w-full gap-6 md:max-w-[64rem] md:grid-cols-2">
        <div className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950">
          <h3 className="mb-4 text-lg font-medium">Stack</h3>
          <dl className="divide-y divide-border border-t">
            {FACTS.map((fact) => (
              <div key={fact.label} className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
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
                  className="text-blue-500 hover:underline"
                >
                  github.com/Dominion116/sortis
                </a>
              </dd>
            </div>
          </dl>
        </div>
        <div className="relative overflow-hidden rounded-lg border bg-background p-6 dark:bg-zinc-950">
          <h3 className="mb-4 text-lg font-medium">Deployed contracts</h3>
          <dl className="divide-y divide-border border-t">
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
            Addresses go live with the Sepolia deployment and are verified on Etherscan.
          </p>
        </div>
      </div>
    </section>
  );
}
