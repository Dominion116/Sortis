import { MOCK } from "@/lib/mock-data";

const FOOTER_LINKS = [
  { href: MOCK.repoUrl, label: "Repository" },
  { href: "#under-the-hood", label: "Deployed contracts" },
  { href: "#faq", label: "FAQ" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-sm">
            <span className="text-lg font-bold tracking-[-0.02em] text-ink">
              Sortis<span className="text-sortis-red">.</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-mute">
              A confidential prize savings protocol on the Zama Protocol.
              Built for the Zama Developer Program, Mainnet Season 4 —
              Bounty Track.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-col gap-3 text-sm">
            {FOOTER_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.href.startsWith("http")
                    ? "noopener noreferrer"
                    : undefined
                }
                className="text-ink/80 transition-colors hover:text-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-col gap-1 text-sm text-mute">
            <span>Target network: Sepolia</span>
            <span>Submission deadline: 5 Sep 2026, 23:59 AOE</span>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs text-mute sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 Sortis. No affiliation with Zama beyond the bounty track.</span>
          <span>Principal withdrawable at any time. Prize is yield only.</span>
        </div>
      </div>
    </footer>
  );
}
