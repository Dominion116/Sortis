import { MarketingConfig } from "types";

/**
 * Nav for the connected-wallet routes. `/app/draws` arrives in Phase 10;
 * only the routes that exist are listed, so nothing here
 * links to a 404.
 */
export const appConfig: MarketingConfig = {
  mainNav: [
    {
      title: "Home",
      href: "/",
    },
    {
      title: "Pool",
      href: "/app",
    },
    {
      title: "Faucet",
      href: "/faucet",
    },
  ],
};
