import type { NextConfig } from "next";

const isPagesPreview = process.env.RFXCHANGE_PAGES_PREVIEW === "1";
const pagesBasePath = isPagesPreview ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE: isPagesPreview ? "1" : (process.env.NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE ?? "0"),
  },
  ...(isPagesPreview
    ? {
        output: "export" as const,
        basePath: pagesBasePath,
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;
