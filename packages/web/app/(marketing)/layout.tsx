import React from "react";

import CircularNavigation from "@/components/navigation";
import FooterPrimary from "@/components/footer-primary";
import { marketingConfig } from "@/config/marketing";

interface MarketingLayoutProps {
  children: React.ReactNode;
}

export default function MarketingLayout({ children }: MarketingLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center">
      <CircularNavigation items={marketingConfig.mainNav} />
      <main className="w-full flex-1">{children}</main>
      <FooterPrimary />
    </div>
  );
}
