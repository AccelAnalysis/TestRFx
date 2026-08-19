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
  const secret = process.env.RFXCHANGE_SESSION_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : "";
}

export function onboardingSessionConfigured() {
  return Boolean(sessionSecret());
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`onboarding:v1:${payload}`).digest("base64url");
}

export function createOnboardingSessionToken(email: string, displayName?: string) {
  const secret = sessionSecret();
  const normalizedEmail = email.trim().toLowerCase();
  if (!secret || !normalizedEmail) return null;

  const now = Math.floor(Date.now() / 1000);
  const session: OnboardingSession = {
    version: 1,
    email: normalizedEmail,
    displayName: displayName?.trim().slice(0, 160) || undefined,
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

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, suppliedSignature] = parts;
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = signature(payload, secret);

  try {
    const supplied = Buffer.from(suppliedSignature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

    const parsed = JSON.parse(decode(payload)) as Partial<OnboardingSession>;
    const now = Math.floor(Date.now() / 1000);
    if (
      parsed.version !== 1 ||
      typeof parsed.email !== "string" ||
      !parsed.email.includes("@") ||
      typeof parsed.verifiedAt !== "number" ||
      typeof parsed.expiresAt !== "number" ||
      parsed.verifiedAt > now + 60 ||
      parsed.expiresAt <= now
    ) return null;

    return {
      version: 1,
      email: parsed.email.trim().toLowerCase(),
      displayName: typeof parsed.displayName === "string" ? parsed.displayName.trim().slice(0, 160) || undefined : undefined,
      verifiedAt: parsed.verifiedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}
