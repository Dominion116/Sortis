"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { MOCK } from "@/lib/mock-data";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#draw", label: "The draw" },
  { href: "#under-the-hood", label: "Under the hood" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-4 z-40 mx-auto w-full max-w-3xl px-4">
      <div className="flex items-center justify-between gap-4 rounded-full border border-border bg-background/80 px-4 py-2 shadow-sm backdrop-blur-md sm:px-6">
        <Link
          href="/"
          className="font-heading text-lg font-semibold tracking-[-0.02em] text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Sortis<span className="text-brand">.</span>
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <ModeToggle />
          <a
            href={MOCK.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-semibold tracking-[-0.01em] text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            View repository
          </a>
        </div>

        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-foreground md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <nav
        aria-label="Primary mobile"
        className={cn(
          "mt-2 flex flex-col gap-1 rounded-2xl border border-border bg-background p-3 shadow-sm md:hidden",
          open ? "block" : "hidden",
        )}
      >
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setOpen(false)}
            className="rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
          >
            {link.label}
          </a>
        ))}
        <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-3 pt-3">
          <ModeToggle />
          <a
            href={MOCK.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 flex-1 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            View repository
          </a>
        </div>
      </nav>
    </header>
  );
}
