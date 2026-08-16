import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Highlights() {
  return (
    <section className="my-16">
      <div className="mb-8 flex w-full items-center">
        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="text-3xl font-bold">Follow the build</h2>
          <Link
            href={siteConfig.links.zama}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-blue-500 hover:underline"
          >
            Zama Developer Program, Mainnet Season 4
          </Link>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-xl items-center justify-center">
        <div className="w-full rounded-lg border bg-background p-8 text-center dark:bg-zinc-950">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sortis is being built in public for the bounty track. The
            repository, this landing page, and the upcoming Sepolia contracts
            are the source of truth. No invented metrics, no placeholder
            testimonials.
          </p>
          <Link
            href={siteConfig.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-block text-blue-500 hover:underline"
          >
            Open the repository
          </Link>
        </div>
      </div>
    </section>
  );
}
