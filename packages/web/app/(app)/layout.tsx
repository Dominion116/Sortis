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
 *
 * The `.app-shell` container lives here rather than on each page, so the banner
 * and the page content share one gutter and one vertical rhythm. App pages must
 * not add their own `.section-shell`, `.container`, or page-level `max-w-*`.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <CircularNavigation items={appConfig.mainNav} action={<ConnectButton />} />
      <main className="w-full flex-1">
        <div className="app-shell app-stack">
          <NetworkGuard />
          {children}
        </div>
      </main>
      <FooterPrimary />
    </div>
  );
}
