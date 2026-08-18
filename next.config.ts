import type { NextConfig } from "next";

const isPagesPreview = process.env.RFXCHANGE_PAGES_PREVIEW === "1";
const pagesBasePath = isPagesPreview ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
