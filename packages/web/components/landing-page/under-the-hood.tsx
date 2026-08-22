import { MOCK } from "@/lib/mock-data";
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
      className="container mb-10 space-y-6 rounded-6xl bg-zinc-100 py-8 dark:bg-zinc-900 md:py-12 lg:py-24"
    >
      <div className="mx-auto flex max-w-[58rem] flex-col items-center space-y-4 text-center">
        <h2 className="font-heading text-3xl leading-[1.1] sm:text-3xl md:text-6xl">
          Under the hood
        </h2>
        <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
          Almost nothing here is invented. The encryption, the token standard,
          and the contract components all come from work that has already been
          audited and used in production, which leaves the draw itself as the
          only genuinely new piece and keeps the surface worth scrutinising
          small.
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
                {MOCK.coverage} statements{" "}
                <span className="font-sans text-xs text-muted-foreground">
                  (solidity-coverage, mock coprocessor)
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
                  className="text-brand hover:underline"
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
                <dd>
                  <AddressValue address={addr.value} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            {live
              ? "Each address opens Sepolia Etherscan. The contracts are verified, so the source you read is the source that runs."
              : "These addresses are filled in when the contracts are deployed to Sepolia, and every one of them is verified on Etherscan so the source you read is the source that runs."}
          </p>
        </div>
      </div>
    </section>
  );
}
