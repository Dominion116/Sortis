import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const lanAddresses = Object.values(networkInterfaces())
  .flatMap((addresses) => addresses ?? [])
  .filter((address) => address.family === "IPv4" && !address.internal)
  .map((address) => address.address);

const configuredDevOrigins = (process.env.SORTIS_DEV_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  serverExternalPackages: ["@zama-fhe/relayer-sdk"],
  // Permit HMR and other dev-only assets when the site is opened from a phone
  // using this machine's LAN address. Extra hostnames can be comma-separated.
  allowedDevOrigins: [...new Set([...lanAddresses, ...configuredDevOrigins])],
  // AppKit's connector barrel (and pino inside WalletConnect) dynamically
  // import optional peers. Webpack still tries to resolve them at build time
  // and fails the Vercel compile if they are absent. `false` tells webpack to
  // ignore the request; the runtime path is never taken.
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string | false | string[]>),
      accounts: false,
      "pino-pretty": false,
    };
    return config;
  },
};

export default nextConfig;
