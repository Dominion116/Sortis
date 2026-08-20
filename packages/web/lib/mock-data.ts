/**
 * Placeholder data for the Phase 1 landing page. Every value here is
 * illustrative, not live, replaced with real reads once the contracts
 * (Phase 2-7) are deployed to Sepolia.
 */

export const MOCK = {
  totalPooled: "184,220.50 cUSDT",
  participantCount: "312",
  nextDrawOffsetMs: 1000 * 60 * 62, // ~1h2m out, demo-pool cadence (client-computed, see Countdown)
  myBalance: "2,481.06",

  lastRound: {
    id: 47,
    prize: "38.14 cUSDT",
    settledAt: "2026-08-11 21:04 UTC",
    txHash: "0x7f3a9c2e1b4d8f6a0c5e9b2d7a1f4c8e3b6d9a2f5c8e1b4d7a0f3c6e9b2d5a8f",
  },

  coverage: "TBD", // real number lands with Phase 6
  deployedAddresses: {
    pool: null as string | null,
    draw: null as string | null,
    faucet: null as string | null,
    token: null as string | null,
  },
  repoUrl: "https://github.com/Dominion116/sortis",

  problemComparison: {
    publicPoolName: "a typical onchain prize pool",
    rows: [
      { address: "0x8f2A...c91B", balance: "12,450.00", odds: "1 in 88" },
      { address: "0x1cE7...4a02", balance: "890.25", odds: "1 in 1,240" },
      { address: "0x9bD4...7f15", balance: "45,102.75", odds: "1 in 24" },
      { address: "0x3aF8...e630", balance: "3,204.50", odds: "1 in 344" },
    ],
  },
} as const;
