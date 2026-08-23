"use client";

import type { SVGProps } from "react";
import Link from "next/link";
import { Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card-header";
import { pools } from "@/config/pools";

export default function Pools() {
  return (
    <section className="section-shell" id="pools">
      <div className="flex min-h-0 w-full flex-col items-center justify-center">
        <h2 className="text-center font-heading text-3xl tracking-tight sm:text-4xl md:text-5xl">
          Three ways in, running the same encrypted draw
        </h2>
        <p className="mt-4 max-w-2xl text-center text-base leading-7 text-muted-foreground sm:text-lg">
          Choose free test tokens, the fast demo, or the standard pool.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pools.map((pool) => (
            <Card key={pool.id} className="w-full max-w-sm rounded-xl border">
              <CardHeader className="flex flex-col justify-center rounded-t-xl">
                <div className="flex items-center">
                  <Moon className="h-8 w-8 fill-zinc-500 text-gray-600" />
                  <CardTitle className="ml-2 text-2xl font-bold">
                    {pool.name}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="py-8 font-heading text-4xl font-bold">
                  {pool.headline}
                </div>
                <p className="mt-2 leading-relaxed text-muted-foreground">
                  {pool.description}
                </p>
                <Button
                  asChild
                  variant="default"
                  className="mt-4 w-full rounded-lg"
                >
                  <Link href={pool.href}>{pool.cta}</Link>
                </Button>
                <ul className="mt-4 space-y-2">
                  {pool.features.map((feature) => (
                    <li key={feature} className="flex items-start space-x-2">
                      <CheckIcon className="mt-0.5 size-5 shrink-0 text-brand" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
