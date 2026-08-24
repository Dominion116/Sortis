"use client";

import * as React from "react";
import Link from "next/link";
import { MainNavItem } from "types";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/mobile-nav";
import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { SunIcon } from "@heroicons/react/24/solid";
import { siteConfig } from "@/config/site";

interface CircularNavProps {
  items?: MainNavItem[];
  children?: React.ReactNode;
}

export default function CircularNavigation({
  items,
  children,
}: CircularNavProps) {
  const [showMobileMenu, setShowMobileMenu] = React.useState<boolean>(false);

  return (
    <nav aria-label="Primary navigation" className="relative z-40 mx-auto mt-3 flex w-[calc(100%-1.5rem)] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm backdrop-blur md:mt-5 md:w-fit md:gap-10 md:rounded-full md:px-5">
      <Link href="/" className="flex items-center space-x-2">
        <div className="rounded-full bg-slate-50 p-1 dark:bg-slate-900">
          <SunIcon className="size-8 transition-transform duration-300 ease-in-out hover:scale-110" />
        </div>
        <span className="font-heading text-lg font-extrabold tracking-tightest md:text-xl">
          SORTIS<span className="text-brand">.</span>
        </span>
      </Link>
      {items?.length ? (
        <div className="hidden space-x-6 md:flex">
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.disabled ? "#" : item.href}
              className={cn(
                "text-primary transition-colors hover:text-foreground/80",
                item.disabled && "cursor-not-allowed opacity-80",
              )}
            >
              {item.title}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="flex items-center space-x-2">
        <Link
          href={siteConfig.links.github}
          target="_blank"
          rel="noreferrer"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "hidden rounded-full p-2 text-xs md:inline-flex md:p-5 md:text-sm",
          )}
        >
          Repository
        </Link>
        <button
          type="button"
          aria-expanded={showMobileMenu}
          aria-controls="mobile-navigation"
          aria-label={showMobileMenu ? "Close navigation" : "Open navigation"}
          className="rounded-md p-2 md:hidden"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          {showMobileMenu ? <Icons.close /> : <Icons.Menu />}
          <span className="sr-only">Menu</span>
        </button>
      </div>
      {showMobileMenu && items ? (
        <div id="mobile-navigation" className="absolute top-full right-0 left-0 mt-2 w-full md:hidden">
          <MobileNav items={items} onNavigate={() => setShowMobileMenu(false)}>
            {children}
          </MobileNav>
        </div>
      ) : null}
    </nav>
  );
}
