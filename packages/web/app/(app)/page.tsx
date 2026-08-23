import type { Metadata } from "next";

import { PoolPanel } from "@/components/app/pool-panel";

export const metadata: Metadata = {
  title: "Your pool",
  description: "Deposit and withdraw confidential cUSDT on Sortis.",
};

export default function AppPage() {
  return <PoolPanel />;
}

