export const features = [
  {
    svgPath:
      "M12 1.5 3 6.25v11.5L12 22.5l9-4.75V6.25L12 1.5Zm0 2.2 6.4 3.38L12 10.45 5.6 7.08 12 3.7ZM4.5 8.7l6.75 3.56v8.16L4.5 16.87V8.7Zm8.25 11.72V12.26L19.5 8.7v8.17l-6.75 3.55Z",
    title: "Deposit encrypts",
    description:
      "The amount you deposit is encrypted in the browser before it reaches the contract. The chain only ever sees ciphertext.",
    link: "/#how-it-works",
  },
  {
    svgPath:
      "M4 19V5h2v14H4Zm4-8h3v8H8v-8Zm5-5h3v13h-3V6Zm5 3h3v10h-3V9Z",
    title: "The pool earns",
    description:
      "Idle funds route to a yield source. Interest accrues to the shared pool, the same public figure any savings product already discloses.",
    link: "/#how-it-works",
  },
  {
    svgPath:
      "M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm1 15h-2v-2h2Zm1.07-7.75-.9.92A1.99 1.99 0 0 0 12 12h-1v-1a2 2 0 0 1 .59-1.42l1.24-1.26A1.5 1.5 0 1 0 11 7H9a3.5 3.5 0 1 1 6.07 2.25Z",
    title: "Draw over ciphertext",
    description:
      "At round close the contract sweeps every encrypted ticket and selects a winner without ever decrypting who holds what.",
    link: "/#draw",
  },
  {
    svgPath:
      "M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z",
    title: "Uniform writes",
    description:
      "Every participant's claimable slot is written on every draw, winners and losers alike, so the state diff itself reveals nothing.",
    link: "/#under-the-hood",
  },
  {
    svgPath:
      "M12 2 4 6v6c0 5.25 3.4 10.16 8 11.5 4.6-1.34 8-6.25 8-11.5V6l-8-4Zm0 2.18 6 3v5.32c0 4.1-2.56 7.94-6 9.14-3.44-1.2-6-5.04-6-9.14V7.18l6-3Z",
    title: "No-loss principal",
    description:
      "Withdraw any time, including mid-round. The only thing at stake is the yield you would otherwise have earned.",
    link: "/#no-loss",
  },
  {
    svgPath:
      "M19 3H5a2 2 0 0 0-2 2v14l4-4h12a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2Zm0 12H6.17L5 16.17V5h14v10Z",
    title: "Public verification",
    description:
      "Ticket count, published total, decrypted random, and the event trail for every settled round stay checkable by anyone.",
    link: "/#under-the-hood",
    fillRule: "evenodd",
  },
];
