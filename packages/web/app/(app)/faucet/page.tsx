import type { Metadata } from "next";

import { FaucetCard } from "@/components/app/faucet-card";
import { explorerAddressUrl, formatAddress, sepolia, TOKEN_SYMBOL } from "@/lib/contracts";

export const metadata: Metadata = {
  title: "Faucet",
  description: `Claim test ${TOKEN_SYMBOL} on Ethereum Sepolia to try Sortis.`,
};

export default function FaucetPage() {
  return (
    <section className="section-shell max-w-3xl space-y-8">
      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Sepolia testnet
        </p>
        <h1 className="font-heading text-4xl tracking-tight md:text-5xl">
          Get test {TOKEN_SYMBOL}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Sortis pools hold {TOKEN_SYMBOL}, a confidential ERC-7984 token
          deployed for this demo. Claim some here, then deposit it into a pool.
          It has no value outside Sepolia.
        </p>
      </div>

      <FaucetCard />

      <div className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-medium">What you should know</h2>
        <ul className="space-y-3 font-sans text-sm leading-relaxed text-muted-foreground">
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
    </section>
  );
}
