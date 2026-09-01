import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const loginFlow = readFileSync("components/identity/LoginFlow.tsx", "utf8");
const nextConfig = readFileSync("next.config.ts", "utf8");
const previewPreparation = readFileSync("scripts/prepare-pages-preview.mjs", "utf8");
const productionLoginRoute = readFileSync("app/api/auth/login/route.ts", "utf8");
const readiness = readFileSync("lib/identity/readiness.ts", "utf8");

describe("GitHub Pages TestRFx access", () => {
  it("uses the existing static-preview flag to expose account-free Exchange access", () => {
    expect(nextConfig).toContain("NEXT_PUBLIC_RFXCHANGE_PAGES_PREVIEW");
    expect(loginFlow).toContain('process.env.NEXT_PUBLIC_RFXCHANGE_PAGES_PREVIEW === "1"');
    expect(loginFlow).toContain("TestRFx preview access");
    expect(loginFlow).toContain("Enter TestRFx");
    expect(loginFlow).toContain('href={initialReturnTo || "/exchange/rfx"}');
  });

  it("states that preview access does not create identity or onboarding truth", () => {
    expect(loginFlow).toContain("does not create an account");
    expect(loginFlow).toContain("establish an authenticated session");
    expect(loginFlow).toContain("purchase a membership");
    expect(loginFlow).toContain("write onboarding progress");
  });

  it("keeps the preview-only boundary explicit", () => {
    expect(previewPreparation).toContain('await rm(join(root, "app/api")');
    expect(previewPreparation).toContain('initialReturnTo="/exchange/rfx"');
  });

  it("leaves production authentication and readiness routing intact", () => {
    expect(productionLoginRoute).toContain("getIdentityGateway");
    expect(productionLoginRoute).toContain("requestMagicLink");
    expect(loginFlow).toContain('fetch("/api/auth/login"');
    expect(readiness).toContain('if (!readiness.accountVerified) return "/onboarding/account-verification"');
    expect(readiness).toContain('if (!readiness.exchangeReady) return "/onboarding/completion"');
  });
});
