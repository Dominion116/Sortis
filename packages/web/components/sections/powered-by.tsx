import { MOCK } from "@/lib/mock-data";

export function PoweredBy() {
  return (
    <section className="border-y border-border bg-muted/30 py-8">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {MOCK.poweredBy.map((name) => (
            <span
              key={name}
              className="text-sm font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
