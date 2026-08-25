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
  // AppKit imports the `@wagmi/connectors` barrel, which dynamically loads
  // optional wallet SDKs. Webpack still resolves those requests at build time
  // and fails if the package is not installed. IgnorePlugin drops the missing
  // peers without replacing `resolve.alias` (that wipe Next's `@/` mapping).
  // Only list packages that are absent; ignoring an installed one would
  // break that connector at runtime.
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp:
          /^(accounts|pino-pretty|@base-org\/account|@metamask\/connect-evm)$/,
      }),
    );
    return config;
  },
};

export default nextConfig;
