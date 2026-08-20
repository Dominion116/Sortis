export const faqItems = [
  {
    question: "What actually stays private?",
    answer:
      "Your deposit amount, the balance you hold in the pool, and the odds that follow from it. All three are encrypted end to end with fully homomorphic encryption, which means the contract computes over them without ever holding a readable copy. That remains true during the draw, when a conventional design would have to decrypt balances in order to weigh them.",
  },
  {
    question: "What stays public?",
    answer:
      "The total value sitting in the pool, and the outcome of each round once it has settled. This is the same information that any pooled savings product publishes as a matter of course, and the pool total is what the prize is calculated from, so hiding it would make the draw impossible to verify. Sortis simply stops there, rather than also publishing who contributed which share of it.",
  },
  {
    question: "Can I lose the money I put in?",
    answer:
      "No. Your principal is withdrawable at any time, including in the middle of a round that has already opened. The only thing you ever stand to lose is the interest you would have earned by saving elsewhere, and that interest is exactly what the pool gathers together to fund the prize.",
  },
  {
    question: "How is a winner chosen if no balance can be read?",
    answer:
      "The contract draws a random value onchain and then walks the list of encrypted tickets, comparing encrypted ranges rather than plaintext amounts, until it establishes which ticket the value falls inside. It never learns whose ticket that was. Because every participant's storage slot is written on every single draw, whether they won or lost, the record left behind on the chain looks the same either way.",
  },
  {
    question: "What happens if the winning ticket was withdrawn mid-round?",
    answer:
      "Nothing is credited to anyone and the prize rolls forward into the next round, which makes the following draw larger. This is the same rollover behaviour Premium Bonds has used since 1957. It is not an error case that slipped through, it is a documented outcome with a test written specifically to exercise it.",
  },
  {
    question: "Is the yield shown here real?",
    answer:
      "Not on testnet, and we say so wherever a prize figure appears. Sepolia has no genuine yield source, so the demo accrues against a pre-funded reserve at a deliberately generous rate in order to make draws worth watching. The production path targets a real confidential vault, and it is written but not yet deployed.",
  },
];
