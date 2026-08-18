import { createHash, randomBytes } from "node:crypto";

const VERIFICATION_TOKEN_BYTES = 32;
const ONBOARDING_SESSION_TOKEN_BYTES = 32;

export function createOpaqueVerificationToken(): string {
  return randomBytes(VERIFICATION_TOKEN_BYTES).toString("base64url");
}

export function createOnboardingSessionToken(): string {
  return randomBytes(ONBOARDING_SESSION_TOKEN_BYTES).toString("base64url");
}

export function hashIdentityToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
