import { MOCK } from "@/lib/mock-data";

const FACTS = [
  { label: "Encryption", value: "Zama Protocol — fully homomorphic encryption" },
  { label: "Token standard", value: "ERC-7984 confidential tokens (OpenZeppelin)" },
  { label: "Network", value: "Ethereum Sepolia" },
  { label: "Contracts", value: "SortisPool · SortisDraw (“ERNIE”) · SortisFaucet" },
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
      className="border-b border-line bg-paper py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-[46ch]">
          <span className="text-xs uppercase tracking-[0.08em] text-mute">
            Under the hood
          </span>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-4xl">
            Built on primitives that are audited, not bespoke.
          </h2>
        </div>

        <div className="mt-12 grid gap-12 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-mute">
              Stack
            </h3>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              {FACTS.map((fact) => (
                <div
                  key={fact.label}
                  className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm"
                >
                  <dt className="text-mute">{fact.label}</dt>
                  <dd className="text-ink">{fact.value}</dd>
                </div>
              ))}
              <div className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
                <dt className="text-mute">Test coverage</dt>
                <dd className="tabular font-mono text-ink">
                  {MOCK.coverage}{" "}
                  <span className="font-sans text-xs text-mute">
                    (lands with the contract suite)
                  </span>
                </dd>
              </div>
              <div className="grid grid-cols-[9rem_1fr] gap-4 py-4 text-sm">
                <dt className="text-mute">Repository</dt>
                <dd>
                  <a
                    href={MOCK.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-red-deep underline decoration-line underline-offset-4 hover:decoration-red-deep"
                  >
                    github.com/Dominion116/sortis
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.06em] text-mute">
              Deployed contracts
            </h3>
            <dl className="mt-4 divide-y divide-line border-t border-line">
              {ADDRESSES.map((addr) => (
                <div
                  key={addr.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 text-sm"
                >
                  <dt className="text-ink">{addr.label}</dt>
                  <dd className="font-mono text-xs text-mute">
                    {addr.value ?? "pending deployment"}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-mute">
              Addresses go live with the Sepolia deployment (Phase 7) and are
              verified on Etherscan.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
