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
    <section className="container mx-auto" id="pools">
      <div className="flex min-h-0 w-full flex-col items-center justify-center py-10">
        <h1 className="text-center text-3xl font-bold">
          Three ways in, running the same encrypted draw
        </h1>
        <p className="mt-2 max-w-[68ch] text-center text-muted-foreground">
          The pools differ only in how long a round lasts and how you get hold
          of the tokens to enter one. The contract underneath them, and the way
          it picks a winner without reading anybody&apos;s balance, is identical
          in every case.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {pools.map((pool) => (
            <Card key={pool.id} className="w-full max-w-sm rounded-4xl border-2">
              <CardHeader className="flex flex-col justify-center rounded-t-4xl">
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
                  className="mt-4 w-full rounded-4xl"
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
