import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: "black",
};

const fontHeading = localFont({
  src: "../assets/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading-face",
  weight: "600",
});

const fontSans = localFont({
  src: [
    {
      path: "../assets/fonts/Inter-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../assets/fonts/Inter-Bold.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans-face",
  display: "swap",
  preload: true,
});

const fontMono = localFont({
  src: "../assets/fonts/GeistMono-Regular.woff2",
  variable: "--font-mono-face",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: [
    "Sortis",
    "Zama",
    "FHE",
    "confidential savings",
    "prize savings",
    "ERC-7984",
  ],
  authors: [{ name: "Sortis" }],
  creator: "Sortis",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: siteConfig.name,
    description: siteConfig.description,
    siteName: siteConfig.name,
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Read the cookie server-side and hand it to wagmi so the first paint
  // already reflects a connected wallet. `headers()` is async in Next.js 16.
  const cookie = (await headers()).get("cookie");

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-mono antialiased",
          fontSans.variable,
          fontHeading.variable,
          fontMono.variable,
        )}
      >
        <Providers cookie={cookie}>{children}</Providers>
      </body>
    </html>
  );
}
