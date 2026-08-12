import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: ReactNode;
  sublabel?: string;
  className?: string;
  tone?: "ink" | "white";
}

export function Stat({ label, value, sublabel, className, tone = "ink" }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn(
          "text-xs uppercase tracking-[0.08em]",
          tone === "white" ? "text-white/70" : "text-mute",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular font-mono text-3xl font-semibold leading-none tracking-[-0.02em] sm:text-4xl",
          tone === "white" ? "text-white" : "text-ink",
        )}
      >
        {value}
      </span>
      {sublabel ? (
        <span
          className={cn(
            "text-sm",
            tone === "white" ? "text-white/70" : "text-mute",
          )}
        >
          {sublabel}
        </span>
      ) : null}
    </div>
  );
}
