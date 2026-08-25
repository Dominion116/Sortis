"use client";

import { createAppKit } from "@reown/appkit/react";

import { projectId, sortisNetwork, wagmiAdapter } from "@/lib/wagmi";
import { siteConfig } from "@/config/site";

let appKit: ReturnType<typeof createAppKit> | undefined;

/** Create AppKit on demand so remote WalletConnect requests never run on
 * static pages that do not need a wallet. */
export function getAppKit() {
  if (typeof window === "undefined" || !projectId) return undefined;

  appKit ??= createAppKit({
    adapters: [wagmiAdapter],
    networks: [sortisNetwork],
    defaultNetwork: sortisNetwork,
    projectId,
    metadata: {
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteConfig.url,
      icons: [`${siteConfig.url}/favicon.ico`],
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
    },
  });

  return appKit;
}
