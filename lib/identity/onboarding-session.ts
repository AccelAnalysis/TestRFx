import { createHmac, timingSafeEqual } from "node:crypto";

export const ONBOARDING_SESSION_COOKIE = "rfx_onboarding_session";
export const ONBOARDING_SESSION_TTL_SECONDS = 24 * 60 * 60;

export type OnboardingSession = {
  version: 1;
  email: string;
  displayName?: string;
  verifiedAt: number;
  expiresAt: number;
};

function sessionSecret() {
  return (process.env.ONBOARDING_SESSION_SECRET || process.env.ACCOUNT_VERIFICATION_SECRET || "").trim();
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createOnboardingSessionToken(email: string, displayName?: string) {
  const secret = sessionSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const session: OnboardingSession = {
    version: 1,
    email: email.trim().toLowerCase(),
    displayName: displayName?.trim() || undefined,
    verifiedAt: now,
    expiresAt: now + ONBOARDING_SESSION_TTL_SECONDS,
  };
  const payload = encode(JSON.stringify(session));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyOnboardingSessionToken(token: string | undefined | null): OnboardingSession | null {
  if (!token) return null;
  const secret = sessionSecret();
  if (!secret) return null;

  const [payload, suppliedSignature] = token.split(".");
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = signature(payload, secret);

  try {
    const supplied = Buffer.from(suppliedSignature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const parsed = JSON.parse(decode(payload)) as OnboardingSession;
    if (parsed.version !== 1 || !parsed.email || parsed.expiresAt <= Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}
