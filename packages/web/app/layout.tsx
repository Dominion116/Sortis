import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Inter as FontSans } from "next/font/google";
import localFont from "next/font/local";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { siteConfig } from "@/config/site";

import "./globals.css";

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontHeading = localFont({
  src: "../assets/fonts/CalSans-SemiBold.woff2",
  variable: "--font-heading",
  weight: "600",
});

const fontMono = localFont({
  src: "../assets/fonts/NotoSansMono-VariableFont_wdth,wght.ttf",
  variable: "--font-mono",
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
    <html lang="en" suppressHydrationWarning>
      <head />
      <body
        className={cn(
          // The Hikari template sets its body copy in monospace and reserves
          // CalSans for display headings. That contrast is the template's
          // signature, so Sortis keeps it, using Noto Sans Mono as the face.
          "min-h-screen bg-background font-mono antialiased",
          fontSans.variable,
          fontHeading.variable,
          fontMono.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <Providers cookie={cookie}>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
