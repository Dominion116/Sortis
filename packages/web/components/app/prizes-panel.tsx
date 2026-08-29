"use client";

import * as React from "react";
import { Gift, Eye, Sparkles } from "lucide-react";
import { toHex } from "viem";
import { useAccount, usePublicClient, useReadContract, useWalletClient, useWriteContract } from "wagmi";

import { ConnectButton } from "@/components/app/connect-button";
import { EncryptedGate } from "@/components/app/encrypted-gate";
import { useNetworkMismatch } from "@/components/app/network-guard";
import { PrizeEnvelopeSkeleton } from "@/components/app/skeletons";
import { ContentFade } from "@/components/motion/page-transition";
import { useFhevm } from "@/components/providers/fhevm-provider";
import { Button } from "@/components/ui/button";
import { useAsyncAction } from "@/hooks/use-async-action";
import {
  explorerTxUrl,
  formatTokenAmount,
  sepolia,
  SEPOLIA_CHAIN_ID,
  sortisPoolAbi,
  TOKEN_SYMBOL,
  type Address,
} from "@/lib/contracts";
import { getUserDecryptSession } from "@/lib/fhevm/user-decryption";

type PoolId = "demo" | "standard";

const zeroHandle = (value?: string) => !value || /^0x0*$/.test(value);

function readableClaimError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/User rejected|denied transaction|rejected the request/i.test(message)) {
    return "You rejected the wallet request.";
  }
  if (/insufficient funds/i.test(message)) {
    return "Not enough Sepolia ETH to pay for gas.";
  }
  if (/execution reverted|The claim transaction reverted|UnauthorizedUseOfEncryptedAmount/i.test(message)) {
    return "The claim transaction reverted. If you already claimed, your encrypted prize is now zero.";
  }
  return message.split("\n")[0];
}

export function PrizesPanel() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { instance } = useFhevm();
  const wrongNetwork = useNetworkMismatch();
  const { writeContractAsync } = useWriteContract();

  // Keyed rather than one shared boolean, so revealing does not grey out the
  // claim button and vice versa. `run` sets its key synchronously, so a button
  // disables on the same render as the click instead of waiting for wagmi.
  const { isPending, run } = useAsyncAction();

  const [poolId, setPoolId] = React.useState<PoolId>("demo");
  const [amount, setAmount] = React.useState<bigint | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<`0x${string}` | null>(null);

  const pool = sepolia[poolId].pool as Address;
  const {
    data: handle,
    isLoading: handleLoading,
    refetch,
  } = useReadContract({
    address: pool,
    abi: sortisPoolAbi,
    functionName: "claimableHandleOf",
    args: address ? [address] : undefined,
    chainId: SEPOLIA_CHAIN_ID,
    query: { enabled: Boolean(address) },
  });

  async function reveal() {
    if (!address || !instance || !walletClient || zeroHandle(handle)) return;
    setMessage("Opening your encrypted prize envelope...");
    try {
      const contracts = [sepolia.token as Address, sepolia.demo.pool as Address, sepolia.standard.pool as Address];
      const session = await getUserDecryptSession(instance, address, contracts, (request) =>
        walletClient.signTypedData(request as never),
      );
      const result = await instance.userDecrypt(
        [{ handle: handle!, contractAddress: pool }],
        session.privateKey,
        session.publicKey,
        session.signature,
        contracts,
        address,
        session.startTimestamp,
        session.durationDays,
      );
      const clear = result[handle!.toLowerCase() as `0x${string}`] ?? result[handle!];
      if (typeof clear !== "bigint") throw new Error("The relayer returned an invalid prize.");
      setAmount(clear);
      setMessage(
        clear > 0n
          ? "You won. Your prize is ready to claim."
          : "No unclaimed prize in this pool yet. Every participant slot is still privately updated each draw.",
      );
    } catch (error) {
      setMessage(readableClaimError(error));
    }
  }

  async function claim() {
    if (!address || !instance || !publicClient || !amount || amount <= 0n) return;
    setHash(null);
    setMessage("Encrypting your private claim amount...");
    try {
      const encrypted = await instance.createEncryptedInput(pool, address).add64(amount).encrypt();
      const tx = await writeContractAsync({
        address: pool,
        abi: sortisPoolAbi,
        functionName: "claim",
        args: [toHex(encrypted.handles[0]), toHex(encrypted.inputProof)],
        chainId: SEPOLIA_CHAIN_ID,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      if (receipt.status !== "success") throw new Error("The claim transaction reverted.");
      setHash(tx);
      setAmount(null);
      setMessage("Prize claimed privately. The confidential tokens are now in your wallet.");
      await refetch();
    } catch (error) {
      setMessage(readableClaimError(error));
    }
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Private prizes
        </p>
        <h1 className="max-w-3xl font-heading text-4xl tracking-tight md:text-5xl">
          Find out without telling everyone else.
        </h1>
        <p className="max-w-2xl text-base leading-7 text-muted-foreground">
          Your result stays encrypted. Reveal it privately, then claim
          confidential tokens without publishing the prize amount.
        </p>
      </div>

      <div className="flex w-fit rounded-lg border p-1" role="tablist" aria-label="Choose a pool">
        {(["demo", "standard"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={poolId === id}
            onClick={() => {
              setPoolId(id);
              setAmount(null);
              setMessage(null);
            }}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              poolId === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {id === "demo" ? "Demo pool" : "Standard pool"}
          </button>
        ))}
      </div>

      {!isConnected ? (
        <div className="rounded-xl border bg-card p-5 sm:p-6">
          <p className="mb-4 text-sm text-muted-foreground">
            Connect your Sepolia wallet to open your prize envelope.
          </p>
          <ConnectButton />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-6 text-center sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border bg-background">
            <Gift className="h-6 w-6 text-brand" aria-hidden="true" />
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Encrypted result
          </p>

          <div aria-live="polite" className="mt-3 flex min-h-16 items-center justify-center">
            {handleLoading ? (
              <PrizeEnvelopeSkeleton />
            ) : amount === null ? (
              <p className="font-mono text-4xl tracking-widest">••••••••</p>
            ) : amount > 0n ? (
              <ContentFade>
                <p className="font-heading text-5xl text-brand">
                  <Sparkles className="mr-2 inline h-7 w-7" aria-hidden="true" />
                  {formatTokenAmount(amount)} {TOKEN_SYMBOL}
                </p>
              </ContentFade>
            ) : (
              <ContentFade>
                <p className="font-heading text-3xl">Not this round</p>
              </ContentFade>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <EncryptedGate label="prize decryption" className="w-full max-w-lg text-left">
              <Button
                variant="outline"
                onClick={() => void run("reveal", reveal)}
                loading={isPending("reveal")}
                disabled={wrongNetwork || handleLoading || zeroHandle(handle) || isPending("claim")}
              >
                <Eye className="mr-2 h-4 w-4" aria-hidden="true" />
                Reveal prize
              </Button>
            </EncryptedGate>
            {amount !== null && amount > 0n ? (
              <Button
                onClick={() => void run("claim", claim)}
                loading={isPending("claim")}
                disabled={wrongNetwork || isPending("reveal")}
              >
                Claim prize
              </Button>
            ) : null}
          </div>

          {message ? (
            <p role="status" className="mt-6 text-sm text-muted-foreground">
              {message}
            </p>
          ) : null}
          {hash ? (
            <a
              className="mt-2 inline-block font-mono text-xs text-brand hover:underline"
              href={explorerTxUrl(hash)}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          ) : null}
        </div>
      )}
    </section>
  );
}
