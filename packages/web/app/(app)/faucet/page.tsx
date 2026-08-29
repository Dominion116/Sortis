import type { Metadata } from "next";

import { FaucetCard } from "@/components/app/faucet-card";
import { explorerAddressUrl, formatAddress, sepolia, TOKEN_SYMBOL } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Faucet",
  description: `Claim test ${TOKEN_SYMBOL} on Ethereum Sepolia to try Sortis.`,
};

export default function FaucetPage() {
  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sepolia testnet</p>
        <h1 className="max-w-3xl font-heading text-4xl tracking-tight md:text-5xl">Fund your first private deposit.</h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">Claim test {TOKEN_SYMBOL}, then use it in a Sortis pool. This faucet is a simple public bridge into the encrypted experience.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <FaucetCard />
        <div className="space-y-5 rounded-xl border bg-card p-5 sm:p-6">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Before you claim</p><h2 className="mt-2 text-xl font-medium">A few useful details</h2></div>
        <ul className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <li>
            You need Sepolia ETH for gas. The faucet only mints {TOKEN_SYMBOL},
            it does not fund your wallet with ETH.
          </li>
          <li>
            The cooldown is tracked per recipient address, so claiming for
            someone else does not reset your own timer.
          </li>
          <li>
            Minting is the one deliberately public operation in Sortis. The
            amount is plaintext because the faucet is a testnet convenience, and
            hiding it would reveal nothing an explorer cannot already read from
            the token contract. Your pool balance, once you deposit, is
            encrypted.
          </li>
          {sepolia.faucet ? (
            <li>
              Faucet contract{" "}
              <a
                href={explorerAddressUrl(sepolia.faucet)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-brand hover:underline"
              >
                {formatAddress(sepolia.faucet)}
              </a>
              , verified on Etherscan.
            </li>
          ) : null}
        </ul>
        </div>
      </div>
    </section>
  );
}
