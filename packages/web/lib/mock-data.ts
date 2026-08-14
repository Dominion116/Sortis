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

  poweredBy: [
    "Zama Protocol",
    "ERC-7984",
    "OpenZeppelin",
    "Ethereum Sepolia",
    "Hardhat",
    "Next.js",
  ],

  problemComparison: {
    publicPoolName: "a typical onchain prize pool",
    rows: [
      { address: "0x8f2A...c91B", balance: "12,450.00", odds: "1 in 88" },
      { address: "0x1cE7...4a02", balance: "890.25", odds: "1 in 1,240" },
      { address: "0x9bD4...7f15", balance: "45,102.75", odds: "1 in 24" },
      { address: "0x3aF8...e630", balance: "3,204.50", odds: "1 in 344" },
    ],
  },

  faq: [
    {
      q: "What actually stays private?",
      a: "Your deposit amount, your balance, and your odds of winning. They're encrypted end to end with fully homomorphic encryption, so the contract itself never sees them in the clear, not even during the draw.",
    },
    {
      q: "What stays public?",
      a: "The total value locked in the pool, and the outcome of each draw once it settles. That's the same information any pooled savings product already discloses. Sortis just stops there instead of also publishing who has what.",
    },
    {
      q: "Can I lose my deposit?",
      a: "No. Principal is withdrawable at any time, including mid-round. The only thing at stake each round is the yield you'd otherwise have earned, and that's what funds the prize.",
    },
    {
      q: "How is a winner chosen without decrypting anyone's balance?",
      a: "The contract draws a random value onchain and walks the encrypted ticket list comparing ciphertext ranges, never plaintext balances. Every participant's storage slot is written on every draw, winners and losers alike, so the state diff itself reveals nothing.",
    },
    {
      q: "What happens if the winning ticket was withdrawn mid-round?",
      a: "No prize is credited and it rolls into the next round. This is the same rollover behavior Premium Bonds has used since 1957. It isn't a bug case, it's a documented, tested outcome.",
    },
    {
      q: "Is the yield on this testnet real?",
      a: "No, Sepolia has no real yield source, and we say so everywhere a prize figure appears. It's clearly labeled simulated testnet yield. The production path, MorphoYieldSource, targets a real confidential vault on Morpho and is written but not deployed.",
    },
  ],
} as const;
