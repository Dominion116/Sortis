"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { CoolMode } from "@/components/magicui/cool-mode";
import { siteConfig } from "@/config/site";

const AnimatedUnderline = ({
  children,
  href,
  className,
}: {
  children: React.ReactNode;
  href: string;
  className?: string;
}) => (
  <a href={href} className={`${className ?? ""} group relative overflow-hidden rounded-sm`}>
    {children}
    <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left scale-x-0 transform bg-current transition-transform duration-500 ease-out group-hover:scale-x-100"></span>
  </a>
);

export default function FooterPrimary() {
  return (
    <footer className="mt-12 border-t py-10 sm:py-14">
      <div className="container">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4">
          <div>
            <h3 className="mb-4 text-base">Protocol</h3>
            <ul className="space-y-2">
              <li>
                <AnimatedUnderline href="/#how-it-works" className="text-primary">
                  How it works
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline href="/#draw" className="text-primary">
                  The draw
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline href="/#no-loss" className="text-primary">
                  No-loss guarantee
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline href="/#under-the-hood" className="text-primary">
                  Under the hood
                </AnimatedUnderline>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-base">Resources</h3>
            <ul className="space-y-2">
              <li>
                <AnimatedUnderline href="/#faq" className="text-primary">
                  FAQ
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline
                  href={siteConfig.links.github}
                  className="text-primary"
                >
                  Repository
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline href={siteConfig.links.zama} className="text-primary">
                  Zama Program
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline
                  href="https://eips.ethereum.org/EIPS/eip-7984"
                  className="text-primary"
                >
                  ERC-7984
                </AnimatedUnderline>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-4 text-base">Connect</h3>
            <ul className="space-y-2">
              <li>
                <AnimatedUnderline
                  href={siteConfig.links.github}
                  className="text-primary"
                >
                  GitHub
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline href="https://www.zama.org" className="text-primary">
                  Zama
                </AnimatedUnderline>
              </li>
              <li>
                <AnimatedUnderline
                  href="https://sepolia.etherscan.io"
                  className="text-primary"
                >
                  Sepolia Explorer
                </AnimatedUnderline>
              </li>
            </ul>
          </div>
          <div className="col-span-2 md:col-span-1">
            <h3 className="mb-4 text-base">Follow the build</h3>
            <p className="mb-4 text-sm leading-6 text-muted-foreground">
              Contracts, tests, and deployment data are public on GitHub.
            </p>
            <CoolMode>
              <Button
                asChild
                className="my-1 mr-1 rounded-md bg-black text-white"
              >
                <a
                  href={siteConfig.links.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowRightIcon className="h-5 w-5" />
                  <span className="sr-only">Open repository</span>
                </a>
              </Button>
            </CoolMode>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center justify-between border-t pt-6 md:flex-row">
          <div className="flex items-center space-x-2">
            <LogInIcon className="h-6 w-6" />
            <span className="font-heading text-xl font-bold">
              Sortis<span className="text-brand">.</span>
            </span>
          </div>
          <p className="mt-4 text-muted-foreground md:mt-0">© Sortis 2026</p>
        </div>
      </div>
    </footer>
  );
}

function ArrowRightIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function LogInIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" x2="3" y1="12" y2="12" />
    </svg>
  );
}
