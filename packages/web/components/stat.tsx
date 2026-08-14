import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  className?: string;
  /** "onPrimary" for use inside a bg-primary panel, where text must pair with primary-foreground. */
  tone?: "default" | "onPrimary";
}

export function Stat({ label, value, sublabel, className, tone = "default" }: StatProps) {
  const isOnPrimary = tone === "onPrimary";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "text-xs uppercase tracking-[0.08em]",
          isOnPrimary ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular font-mono text-3xl font-semibold leading-none tracking-[-0.02em] sm:text-4xl",
          isOnPrimary ? "text-primary-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
      {sublabel ? (
        <span
          className={cn(
            "text-sm",
            isOnPrimary ? "text-primary-foreground/70" : "text-muted-foreground",
          )}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
