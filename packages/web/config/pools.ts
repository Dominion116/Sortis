export const pools = [
  {
    id: "faucet",
    name: "Faucet",
    headline: "Free",
    description: "Mint test cUSDT on Sepolia so a reviewer can try the pool with an empty wallet.",
    cta: "Get test tokens",
    href: "/#under-the-hood",
    features: [
      "One-click mint on a cooldown",
      "Confidential ERC-7984 test token",
      "No mainnet funds required",
      "Built for the judge journey",
    ],
  },
  {
    id: "demo",
    name: "Demo pool",
    headline: "5 min",
    description: "A continuous five-minute round so there is always a draw within reach, whatever minute you arrived.",
    cta: "Watch the draw",
    href: "/#draw",
    features: [
      "Rounds close every five minutes",
      "Simulated testnet yield, labeled as such",
      "Live sweep progress in the app",
      "Same encrypted draw as the standard pool",
    ],
  },
  {
    id: "standard",
    name: "Standard pool",
    headline: "Yield only",
    description: "A realistic-length round. Principal stays yours. The prize is the pool's accrued yield, nothing else.",
    cta: "See how it works",
    href: "/#how-it-works",
    features: [
      "Deposit encrypts in the browser",
      "Withdraw any time, including mid-round",
      "Winner selected over ciphertext",
      "Fairness checkable without a wallet",
    ],
  },
];
