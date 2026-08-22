export { sepolia, SEPOLIA_CHAIN_ID, SEPOLIA_EXPLORER, type Address } from "./addresses";
export {
  sortisPoolAbi,
  sortisDrawAbi,
  sortisFaucetAbi,
  confidentialUsdtAbi,
  mockYieldSourceAbi,
} from "./abis";

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

/**
 * cUSDT carries 6 decimals, matching the USDT it stands in for, and every
 * on-chain amount is a `uint64`. Formatting stays here rather than in a
 * component so the faucet, the pool and the prize copy cannot drift apart.
 */
export const TOKEN_DECIMALS = 6;
export const TOKEN_SYMBOL = "cUSDT";

export function formatTokenAmount(units: bigint, maximumFractionDigits = 2): string {
  const scale = 10n ** BigInt(TOKEN_DECIMALS);
  const whole = units / scale;
  const fraction = units % scale;

  if (fraction === 0n || maximumFractionDigits === 0) {
    return whole.toLocaleString("en-US");
  }

  const fractionText = fraction
    .toString()
    .padStart(TOKEN_DECIMALS, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");

  return fractionText.length > 0
    ? `${whole.toLocaleString("en-US")}.${fractionText}`
    : whole.toLocaleString("en-US");
}
