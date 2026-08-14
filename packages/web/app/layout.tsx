import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";

import { ThemeProvider } from "@/components/theme-provider";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const calsans = localFont({
  src: "../assets/fonts/CalSans-SemiBold.woff2",
  variable: "--font-calsans",
  weight: "600",
});

const notoMono = localFont({
  src: "../assets/fonts/NotoSansMono-VariableFont_wdth,wght.ttf",
  variable: "--font-noto-mono",
});

export const metadata: Metadata = {
  title: "Sortis: a confidential prize savings protocol",
  description:
    "Deposit a confidential token, keep your principal, and let the pool's yield fund one encrypted prize draw per round. Built on the Zama Protocol with fully homomorphic encryption.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${calsans.variable} ${notoMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
