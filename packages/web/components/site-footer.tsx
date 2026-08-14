import { MOCK } from "@/lib/mock-data";

const COLUMNS = [
  {
    title: "Protocol",
    links: [
      { href: "#how-it-works", label: "How it works" },
      { href: "#draw", label: "The draw" },
      { href: "#under-the-hood", label: "Under the hood" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: MOCK.repoUrl, label: "Repository", external: true },
      { href: "#under-the-hood", label: "Deployed contracts" },
      { href: "#faq", label: "FAQ" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-[1.3fr_1fr_1fr]">
          <div className="max-w-sm">
            <span className="font-heading text-lg font-semibold tracking-[-0.02em] text-foreground">
              Sortis<span className="text-brand">.</span>
            </span>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A confidential prize savings protocol on the Zama Protocol.
              Built for the Zama Developer Program, Mainnet Season 4, Bounty
              Track.
            </p>
            <p className="mt-4 text-sm font-medium text-foreground">
              Principal withdrawable any time. Prize is yield only.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-sm font-semibold text-foreground">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>Copyright 2026 Sortis. No affiliation with Zama beyond the bounty track.</span>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
            <span>Target network: Sepolia</span>
            <span>Submission deadline: 5 Sep 2026, 23:59 AOE</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
