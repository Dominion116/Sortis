export const faqItems = [
  {
    question: "What actually stays private?",
    answer:
      "Your deposit, pool balance, and resulting odds stay encrypted. The contract computes over them without receiving a readable copy, including during the draw.",
  },
  {
    question: "What stays public?",
    answer:
      "The pool total and each settled round outcome are public so the prize and draw can be verified. Individual contributions are not public.",
  },
  {
    question: "Can I lose the money I put in?",
    answer:
      "No. Your principal is withdrawable at any time, including mid-round. The pooled interest funds the prize.",
  },
  {
    question: "How is a winner chosen if no balance can be read?",
    answer:
      "The contract compares a random value against encrypted ticket ranges. Every participant's claimable slot is written, so the state diff does not identify the winner.",
  },
  {
    question: "What happens if the winning ticket was withdrawn mid-round?",
    answer:
      "Nobody is credited and the prize rolls into the next round. This is a documented, tested outcome.",
  },
  {
    question: "Is the yield shown here real?",
    answer:
      "Not on Sepolia. Demo yield comes from a pre-funded reserve and is labelled illustrative. Production will use a real yield source.",
  },
];
