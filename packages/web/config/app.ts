import { MarketingConfig } from "types";

/**
 * Nav for the connected-wallet routes. `/app` and `/app/draws` arrive in
 * Phases 9 and 10; only the routes that exist are listed, so nothing here
 * links to a 404.
 */
export const appConfig: MarketingConfig = {
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Faucet",
      href: "/faucet",
    },
  ],
};
