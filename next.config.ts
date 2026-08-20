import type { NextConfig } from "next";

const isPagesPreview = process.env.RFXCHANGE_PAGES_PREVIEW === "1";
const pagesBasePath = isPagesPreview ? (process.env.PAGES_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_RFXCHANGE_PAGES_PREVIEW: isPagesPreview ? "1" : "0",
  },
  ...(isPagesPreview
    ? {
        output: "export" as const,
        basePath: pagesBasePath,
        trailingSlash: true,
        images: { unoptimized: true },
        // Visual previews are intentionally decoupled from repository-wide
        // production type validation. chassis-ci remains the merge-quality gate.
        // The static build must still successfully bundle/export the preview.
        typescript: { ignoreBuildErrors: true },
      }
    : {}),
};

export default nextConfig;
