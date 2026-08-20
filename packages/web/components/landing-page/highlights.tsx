import Link from "next/link";
import { siteConfig } from "@/config/site";

export default function Highlights() {
  return (
    <section className="container my-16">
      <div className="mb-8 flex w-full items-center">
        <div className="flex w-full flex-col items-center justify-center">
          <h2 className="text-3xl font-bold">Follow the build</h2>
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
        <div className="w-full rounded-lg border bg-background p-8 text-center dark:bg-zinc-950">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Sortis is being built in the open as an entry to the Zama Developer
            Program. The contracts, the tests, and this page all live in the
            same public repository, so you can read the draw logic yourself
            rather than take any of the claims above on faith. Anything on this
            page that is still illustrative is labelled that way until the
            deployment replaces it with the real figure.
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
