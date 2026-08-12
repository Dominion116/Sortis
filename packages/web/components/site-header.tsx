import Link from "next/link";

import { MOCK } from "@/lib/mock-data";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#draw", label: "The draw" },
  { href: "#under-the-hood", label: "Under the hood" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-bold tracking-[-0.02em] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          Sortis<span className="text-sortis-red">.</span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-8 md:flex"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-ink/80 transition-colors hover:text-red-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={MOCK.repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center border border-ink px-4 text-sm font-semibold tracking-[-0.01em] text-ink transition-colors hover:bg-ink hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          View repository
        </a>
      </div>
    </header>
  );
}
