export const faqItems = [
  {
    question: "What actually stays private?",
    answer:
      "Your deposit amount, your balance, and your odds of winning. They are encrypted end to end with fully homomorphic encryption, so the contract itself never sees them in the clear, not even during the draw.",
  },
  {
    question: "What stays public?",
    answer:
      "The total value locked in the pool, and the outcome of each draw once it settles. That is the same information any pooled savings product already discloses. Sortis just stops there instead of also publishing who has what.",
  },
  {
    question: "Can I lose my deposit?",
    answer:
      "No. Principal is withdrawable at any time, including mid-round. The only thing at stake each round is the yield you would otherwise have earned, and that is what funds the prize.",
  },
  {
    question: "How is a winner chosen without decrypting anyone's balance?",
    answer:
      "The contract draws a random value onchain and walks the encrypted ticket list comparing ciphertext ranges, never plaintext balances. Every participant's storage slot is written on every draw, winners and losers alike, so the state diff itself reveals nothing.",
  },
  {
    question: "What happens if the winning ticket was withdrawn mid-round?",
    answer:
      "No prize is credited and it rolls into the next round. This is the same rollover behavior Premium Bonds has used since 1957. It is not a bug case, it is a documented, tested outcome.",
  },
  {
    question: "Is the yield on this testnet real?",
    answer:
      "No. Sepolia has no real yield source, and we say so everywhere a prize figure appears. It is clearly labeled simulated testnet yield. The production path, MorphoYieldSource, targets a real confidential vault on Morpho and is written but not deployed.",
  },
];
