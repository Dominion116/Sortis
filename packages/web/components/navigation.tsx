"use client";

import * as React from "react";
import Link from "next/link";
import { MainNavItem } from "types";
import { cn } from "@/lib/utils";
import { MobileNav } from "@/components/mobile-nav";
import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
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
    <nav className="relative mx-auto mt-4 flex w-full flex-wrap items-center justify-between gap-4 p-2 backdrop-blur-sm md:w-fit md:gap-20 md:rounded-full md:border-2 md:border-muted/30 md:bg-zinc-50 md:p-1 md:px-8 md:shadow-md md:backdrop-blur-none md:dark:border-muted/80 md:dark:bg-zinc-900">
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
        <div className="hidden md:block">
          <ModeToggle />
        </div>
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
          className="md:hidden"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
        >
          {showMobileMenu ? <Icons.close /> : <Icons.Menu />}
          <span className="sr-only">Menu</span>
        </button>
      </div>
      {showMobileMenu && items ? (
        <div className="absolute top-full right-0 left-0 mt-2 w-full md:hidden">
          <MobileNav items={items}>{children}</MobileNav>
        </div>
      ) : null}
    </nav>
  );
}
