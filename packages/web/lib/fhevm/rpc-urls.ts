const PUBLIC_SEPOLIA_RPC_URLS = [
  "https://ethereum-sepolia-rpc.publicnode.com",
  "https://sepolia.gateway.tenderly.co",
] as const;

/** Server-safe Sepolia RPC list. Used by the `/api/rpc` proxy. */
export function sepoliaUpstreamRpcUrls(): string[] {
  const configured = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim();
  return [
    ...new Set(
      [configured, ...PUBLIC_SEPOLIA_RPC_URLS].filter((url): url is string => Boolean(url)),
    ),
  ];
}
