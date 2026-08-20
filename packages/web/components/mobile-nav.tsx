"use client";

import * as React from "react";
import Link from "next/link";
import { MainNavItem } from "types";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { buttonVariants } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { useLockBody } from "@/hooks/use-lock-body";
import { siteConfig } from "@/config/site";

interface MobileNavProps {
  items: MainNavItem[];
  children?: React.ReactNode;
  /** Closes the menu once a link is taken, so the panel never covers the target. */
  onNavigate?: () => void;
}

export function MobileNav({ items, children, onNavigate }: MobileNavProps) {
  useLockBody();

  return (
    <div
      className={cn(
        "fixed inset-0 top-4 z-50 mx-auto grid h-[calc(100vh-4rem)] w-full grid-flow-row auto-rows-max overflow-auto p-6 pb-32 shadow-md animate-in slide-in-from-bottom-80 md:hidden",
      )}
    >
      <div className="relative z-20 grid gap-6 rounded-md bg-popover p-4 text-popover-foreground shadow-md">
        <Link href="/" className="flex items-center space-x-2" onClick={onNavigate}>
          <Icons.Eclipse />
          <span className="font-heading font-bold">
            Sortis<span className="text-brand">.</span>
          </span>
        </Link>
        <nav className="grid auto-rows-max grid-flow-row items-center text-center text-sm">
          {items.map((item, index) => (
            <Link
              key={index}
              href={item.disabled ? "#" : item.href}
              onClick={onNavigate}
              className={cn(
                "flex w-full items-center rounded-md p-2 text-sm font-medium hover:underline",
                item.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <div className="mt-4 flex items-center space-x-2">
          <ModeToggle />
          <Link
            href={siteConfig.links.github}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "px-4")}
          >
            Repository
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
