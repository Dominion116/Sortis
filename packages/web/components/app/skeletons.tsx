"use client";

import { Skeleton } from "@/components/app/encrypted-gate";
import { cn } from "@/lib/utils";

/**
 * Panel-level skeletons for the app screens.
 *
 * `loading.tsx` only covers the wait while a route streams. The real wait on
 * every app screen is an RPC read inside a client component, which resolves
 * long after the route skeleton has gone. These stand in for that second wait,
 * and each one is sized to the content it replaces so the swap does not shift
 * the layout.
 *
 * The primitive `Skeleton` stays in `encrypted-gate.tsx`, where the SDK gate
 * already uses it; this module only composes it.
 */

/** Page heading block: eyebrow, title, supporting line. */
export function HeadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-4 w-full max-w-2xl" />
    </div>
  );
}

/** One label-over-value pair, as used in the faucet and draw metadata grids. */
export function StatSkeleton({
  labelWidth = "w-24",
  valueWidth = "w-32",
}: {
  labelWidth?: string;
  valueWidth?: string;
}) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-3", labelWidth)} />
      <Skeleton className={cn("h-7", valueWidth)} />
    </div>
  );
}

/**
 * Stand-in for one `DrawCard`.
 *
 * Matches the real card's structure (header, state pill, a bordered middle
 * block, and the four-column metadata grid) rather than being a generic box, so
 * the resolved card does not visibly re-flow into place.
 */
export function DrawCardSkeleton() {
  return (
    <article
      className="space-y-6 rounded-xl border bg-card p-5 sm:p-6"
      aria-hidden="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-40" />
        </div>
        <Skeleton className="h-7 w-28 rounded-full" />
      </div>
      <div className="space-y-3 border-y py-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <StatSkeleton key={item} labelWidth="w-16" valueWidth="w-20" />
        ))}
      </div>
    </article>
  );
}

/** Stand-in for the ticket rows on the pool screen. */
export function TicketListSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="divide-y" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          className="flex flex-col justify-between gap-4 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
      ))}
    </div>
  );
}

/** Stand-in for the prize envelope's amount line while its handle is read. */
export function PrizeEnvelopeSkeleton() {
  return (
    <div className="flex flex-col items-center gap-3" aria-hidden="true">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}
