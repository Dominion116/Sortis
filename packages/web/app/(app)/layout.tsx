import React from "react";

import CircularNavigation from "@/components/navigation";
import FooterPrimary from "@/components/footer-primary";
import { ConnectButton } from "@/components/app/connect-button";
import { NetworkGuard } from "@/components/app/network-guard";
import { appConfig } from "@/config/app";

/**
 * Shell for the connected-wallet routes.
 *
 * Mirrors the marketing layout so the two halves of the site do not feel like
 * different products, and adds the two things every app route needs: a connect
 * control in the nav, and the network-mismatch banner directly above the
 * content, where it cannot be scrolled past.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <CircularNavigation items={appConfig.mainNav}>
        <ConnectButton className="mt-4" />
      </CircularNavigation>
      <main className="w-full flex-1">
        <div className="container mx-auto max-w-5xl px-4 pt-8">
          <NetworkGuard />
        </div>
        {children}
      </main>
      <FooterPrimary />
    </div>
  );
}
