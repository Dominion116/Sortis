import {
  explorerAddressUrl,
  formatAddress,
  sepolia,
} from "@/lib/contracts";

const FACTS = [
  { label: "Encryption", value: "Zama Protocol, fully homomorphic encryption" },
  {
    label: "Token standard",
    value: "ERC-7984 confidential tokens, via OpenZeppelin",
  },
  { label: "Network", value: "Ethereum Sepolia" },
  {
    label: "Contracts",
    value: "SortisPool, SortisDraw, SortisFaucet",
  },
];

const ADDRESSES: { label: string; value: string | null }[] = [
  { label: "Confidential token (cUSDT)", value: sepolia.token },
  { label: "SortisFaucet", value: sepolia.faucet },
  { label: "Demo pool", value: sepolia.demo.pool },
  { label: "Demo draw", value: sepolia.demo.draw },
  { label: "Standard pool", value: sepolia.standard.pool },
  { label: "Standard draw", value: sepolia.standard.draw },
];

function AddressValue({ address }: { address: string | null }) {
  if (!address) {
    return <span className="font-mono text-xs text-muted-foreground">pending deployment</span>;
  }

  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      title={address}
      className="font-mono text-xs text-brand hover:underline"
    >
      {formatAddress(address)}
    </a>
  );
}

export default function UnderTheHood() {
  const live = Boolean(sepolia.token);

  return (
    <section
      id="under-the-hood"
      className="section-shell space-y-10 rounded-3xl bg-muted/70 px-4 sm:px-6 lg:px-8"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Under the hood
        </h2>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
          Built with Zama FHE, ERC-7984 confidential tokens, and verified
          contracts on Sepolia.
        </p>
      </div>
      <div className="mx-auto grid w-full gap-6 md:max-w-[64rem] md:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border bg-card p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-medium">Stack</h3>
          <dl className="divide-y divide-border border-t">
            {FACTS.map((fact) => (
              <div key={fact.label} className="grid gap-1 py-4 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd className="text-foreground">{fact.value}</dd>
              </div>
            ))}
            <div className="grid gap-1 py-4 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Test coverage</dt>
              <dd className="tabular font-mono text-foreground">
                97.1% statements{" "}
                <span className="font-sans text-xs text-muted-foreground">
                  (solidity-coverage, mock coprocessor)
                </span>
              </dd>
            </div>
            <div className="grid gap-1 py-4 text-sm sm:grid-cols-[9rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Repository</dt>
              <dd>
                <a
                  href="https://github.com/Dominion116/sortis"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand hover:underline"
                >
                  github.com/Dominion116/sortis
                </a>
              </dd>
            </div>
          </dl>
        </div>
        <div className="relative overflow-hidden rounded-xl border bg-card p-5 sm:p-6">
          <h3 className="mb-4 text-lg font-medium">Deployed contracts</h3>
          <dl className="divide-y divide-border border-t">
            {ADDRESSES.map((addr) => (
              <div
                key={addr.label}
                className="grid gap-1 py-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
              >
                <dt className="text-foreground">{addr.label}</dt>
                <dd>
                  <AddressValue address={addr.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {live
              ? "Each address opens Sepolia Etherscan. The contracts are verified, so the source you read is the source that runs."
              : "Deployment addresses will appear here once a Sepolia set is published."}
          </p>
        </div>
      </div>
    </section>
  );
}
