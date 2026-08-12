import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sortis — a confidential prize savings protocol",
  description:
    "Deposit a confidential token, keep your principal, and let the pool's yield fund one encrypted prize draw per round. Built on the Zama Protocol with fully homomorphic encryption.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans text-ink bg-white">
        {children}
      </body>
    </html>
  );
}
