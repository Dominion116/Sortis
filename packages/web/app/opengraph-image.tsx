import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${siteConfig.name}, confidential prize savings on the Zama Protocol`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#ffffff",
          padding: "72px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34 }}>
          <span style={{ fontWeight: 700, color: "#09090b" }}>Sortis</span>
          <span style={{ fontWeight: 700, color: "#2563eb" }}>.</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div
            style={{
              fontSize: 62,
              lineHeight: 1.15,
              color: "#09090b",
              letterSpacing: "-0.02em",
              maxWidth: "960px",
            }}
          >
            Everyone saves together, one person wins the yield, and nobody can
            see who holds what.
          </div>
          <div style={{ fontSize: 27, color: "#71717a", maxWidth: "880px" }}>
            A no-loss prize savings pool built on the Zama Protocol.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: "36px",
            fontSize: 22,
            color: "#71717a",
          }}
        >
          <span>Zama Protocol</span>
          <span>ERC-7984</span>
          <span>Ethereum Sepolia</span>
        </div>
      </div>
    ),
    size,
  );
}
