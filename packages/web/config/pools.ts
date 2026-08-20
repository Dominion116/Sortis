export const pools = [
  {
    id: "faucet",
    name: "Faucet",
    headline: "Free",
    description:
      "If you have never touched this network before, start here. The faucet mints test cUSDT to any address on a short cooldown, so an empty wallet is all you need to try the pool properly.",
    cta: "Get test tokens",
    href: "/#under-the-hood",
    features: [
      "Mints to any address in a single transaction",
      "Issues the same ERC-7984 confidential token the pools use",
      "Requires no mainnet funds and no prior balance",
      "Exists so a reviewer can arrive cold and still take part",
    ],
  },
  {
    id: "demo",
    name: "Demo pool",
    headline: "Five minutes",
    description:
      "A round here opens and settles every five minutes, which makes it the pool to watch if you want to see the whole mechanism resolve rather than read about it.",
    cta: "Watch a draw",
    href: "/#draw",
    features: [
      "Closes, draws, and settles a full round every five minutes",
      "Yield is simulated on testnet and labelled as such throughout",
      "Shows the encrypted sweep advancing ticket by ticket",
      "Runs the identical draw logic used by the standard pool",
    ],
  },
  {
    id: "standard",
    name: "Standard pool",
    headline: "Yield only",
    description:
      "The pool as it is meant to be used, with a round length that resembles a real savings product. Your principal stays yours throughout and the prize is drawn purely from accrued interest.",
    cta: "See how it works",
    href: "/#how-it-works",
    features: [
      "Encrypts your deposit locally before it is submitted",
      "Lets you withdraw at any point, including mid-round",
      "Selects its winner entirely over encrypted balances",
      "Publishes enough for anyone to check the result without a wallet",
    ],
  },
];
