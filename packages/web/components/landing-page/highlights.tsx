import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Highlights() {
  return (
    <section className="section-shell">
      <div className="mb-8 flex w-full items-center">
        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="font-heading text-3xl tracking-tight sm:text-4xl">Follow the build</h2>
          <Link
            href={siteConfig.links.zama}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-brand hover:underline"
          >
            Zama Developer Program, Mainnet Season 4
          </Link>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-xl border bg-card p-6 text-center sm:p-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Built in the open for the Zama Developer Program. Read the
            contracts, tests, and deployment data in the repository.
          </p>
          <Link
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-brand hover:underline"
          >
            Read the source on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}
