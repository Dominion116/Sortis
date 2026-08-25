import React from "react";

import CircularNavigation from "@/components/navigation";
import FooterPrimary from "@/components/footer-primary";
import { marketingConfig } from "@/config/marketing";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <CircularNavigation
        items={marketingConfig.mainNav}
        action={<Button asChild className="rounded-full" size="sm"><Link href="/app">Open app</Link></Button>}
      />
      <main className="w-full flex-1">{children}</main>
      <FooterPrimary />
    </div>
  );
}
