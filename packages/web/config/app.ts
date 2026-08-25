import { MarketingConfig } from "types";

/**
 * Nav for the connected-wallet routes. Only routes that exist are listed, so
 * nothing here links to a 404.
 *
 * Every href must match a real directory segment under `app/(app)`. Route
 * groups in parentheses contribute no URL segment, so the Draws page lives at
 * `app/(app)/app/draws/page.tsx` to resolve to `/app/draws`. Placing it at
 * `app/(app)/draws/` would serve it from `/draws` and 404 this link.
 */
export const appConfig: MarketingConfig = {
  mainNav: [
    {
      title: "Pool",
      href: "/pool",
    },
    {
      title: "Draws",
      href: "/app/draws",
    },
    {
      title: "Prizes",
      href: "/app/prizes",
    },
    {
      title: "Faucet",
      href: "/faucet",
    },
  ],
};
