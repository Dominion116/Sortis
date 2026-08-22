export { sepolia, SEPOLIA_CHAIN_ID, SEPOLIA_EXPLORER, type Address } from "./addresses";

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}
