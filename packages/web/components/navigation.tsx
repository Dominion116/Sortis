"use client";

import * as React from "react";
import Link from "next/link";
import { MainNavItem } from "types";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/mobile-nav";
import { Icons } from "@/components/icons";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { usePathname } from "next/navigation";

interface CircularNavProps {
  items?: MainNavItem[];
  action?: React.ReactNode;
  children?: React.ReactNode;
}

export default function CircularNavigation({
  items,
  action,
  children,
}: CircularNavProps) {
  const [showMobileMenu, setShowMobileMenu] = React.useState<boolean>(false);
  const [pendingPath, setPendingPath] = React.useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const pathname = usePathname();
  const isNavigating = pendingPath !== null && pendingPath !== pathname;

  const markNavigation = (event: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) return;

    const targetPath = href.split("#")[0] || pathname;
    if (targetPath !== pathname) setPendingPath(targetPath);
  };

  return (
    <motion.nav initial={reduceMotion ? false : { opacity: 0, y: -12 }} animate={reduceMotion ? undefined : { opacity: 1, y: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} aria-label="Primary navigation" aria-busy={isNavigating} className="relative z-40 mx-auto mt-3 flex w-[calc(100%-1.5rem)] flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 p-2 shadow-sm backdrop-blur md:mt-5 md:w-fit md:gap-10 md:rounded-full md:px-5">
      {isNavigating && !reduceMotion ? <span aria-hidden="true" className="nav-route-progress absolute inset-x-5 bottom-0 h-px overflow-hidden rounded-full bg-border" /> : null}
      <Link href="/" onClick={(event) => markNavigation(event, "/")} className="flex items-center space-x-2">
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
              onClick={(event) => markNavigation(event, item.disabled ? "#" : item.href)}
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
        <div className="hidden md:block">{action}</div>
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
          <MobileNav items={items} onClose={() => setShowMobileMenu(false)} onNavigate={() => setShowMobileMenu(false)}>
            {action ?? children}
          </MobileNav>
        </div>
      ) : null}
    </motion.nav>
  );
}
