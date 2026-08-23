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
  // Permit HMR and other dev-only assets when the site is opened from a phone
  // using this machine's LAN address. Extra hostnames can be comma-separated.
  allowedDevOrigins: [...new Set([...lanAddresses, ...configuredDevOrigins])],
};

export default nextConfig;
