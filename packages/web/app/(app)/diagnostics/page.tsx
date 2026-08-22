import type { Metadata } from "next";

import { DiagnosticsPanel } from "@/components/app/diagnostics-panel";

export const metadata: Metadata = {
  title: "Diagnostics",
  description:
    "Verifies that the wallet connection, the network and the Zama Relayer SDK all initialise in the browser.",
  robots: { index: false, follow: false },
};

/**
 * The throwaway page the PRD's risk mitigation asks for: prove the Relayer SDK
 * survives the App Router's server pass here, before Phases 9 to 11 build real
 * screens on top of it.
 *
 * Kept in the repo rather than deleted. It costs one route, it is `noindex`,
 * and when the SDK breaks after a dependency bump this is the page that says
 * so in one glance instead of a deposit form failing for unclear reasons.
 */
export default function DiagnosticsPage() {
  return (
    <section className="container mx-auto max-w-3xl space-y-8 px-4 py-12">
      <div className="space-y-3">
        <p className="font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Internal
        </p>
        <h1 className="font-heading text-3xl leading-[1.1] md:text-4xl">
          Diagnostics
        </h1>
        <p className="font-sans leading-normal text-muted-foreground">
          A smoke test for the application shell. If every row below reports
          ready, then wallet connection, chain detection and the Zama Relayer
          SDK are all working in this browser, and the encrypted screens have
          everything they depend on.
        </p>
      </div>
      <DiagnosticsPanel />
    </section>
  );
}
