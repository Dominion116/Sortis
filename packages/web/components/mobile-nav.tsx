"use client";

import * as React from "react";
import Link from "next/link";
import { MainNavItem } from "types";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { useLockBody } from "@/hooks/use-lock-body";

interface MobileNavProps {
  items: MainNavItem[];
  children?: React.ReactNode;
  onClose?: () => void;
  /** Closes the menu once a link is taken, so the panel never covers the target. */
  onNavigate?: () => void;
}

export function MobileNav({ items, children, onClose, onNavigate }: MobileNavProps) {
  useLockBody();

  return (
    <div
      role="dialog"
      aria-label="Mobile navigation"
      className="fixed inset-0 z-50 bg-background/30 p-4 backdrop-blur-sm animate-in fade-in md:hidden"
      onClick={onClose}
    >
      <div className="mx-auto mt-16 grid w-full max-w-sm gap-6 rounded-xl bg-popover p-4 text-popover-foreground shadow-xl animate-in slide-in-from-top-2" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <button type="button" aria-label="Close navigation" className="rounded-md p-2 hover:bg-muted" onClick={onClose}>
            <Icons.close className="size-5" />
          </button>
        </div>
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
        {children}
      </div>
    </div>
  );
}
