import type { ReactNode } from "react";

import { PageTransition } from "@/components/motion/page-transition";

export default function MarketingTemplate({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
