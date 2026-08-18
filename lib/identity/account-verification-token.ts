import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  ACCOUNT_VERIFICATION_PURPOSE,
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  type AccountVerificationContext,
  type VerificationTokenPayload,
} from "@/lib/identity/account-verification";

const DEVELOPMENT_SECRET = "rfxchange-reference-account-verification-secret";

function getVerificationSecret(): string | null {
  const configured = process.env.ACCOUNT_VERIFICATION_SECRET?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : DEVELOPMENT_SECRET;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export type TokenVerificationResult =
  | { ok: true; payload: VerificationTokenPayload }
  | { ok: false; reason: "configuration_error" | "invalid" | "expired" };

export function createReferenceVerificationToken(
  email: string,
  context: AccountVerificationContext,
  now = Date.now(),
): { token: string; payload: VerificationTokenPayload } | null {
  const secret = getVerificationSecret();
  if (!secret) return null;

  const issuedAt = Math.floor(now / 1000);
  const payload: VerificationTokenPayload = {
    version: 1,
    purpose: ACCOUNT_VERIFICATION_PURPOSE,
    email,
    issuedAt,
    expiresAt: issuedAt + ACCOUNT_VERIFICATION_TTL_SECONDS,
    nonce: randomBytes(18).toString("base64url"),
    context,
  };

  const encodedPayload = encode(JSON.stringify(payload));
  return {
    token: `${encodedPayload}.${sign(encodedPayload, secret)}`,
    payload,
  };
}

function isPayload(value: unknown): value is VerificationTokenPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<VerificationTokenPayload>;
  return (
    candidate.version === 1 &&
    candidate.purpose === ACCOUNT_VERIFICATION_PURPOSE &&
    typeof candidate.email === "string" &&
    typeof candidate.issuedAt === "number" &&
    typeof candidate.expiresAt === "number" &&
    typeof candidate.nonce === "string" &&
    !!candidate.context &&
    typeof candidate.context === "object"
  );
}

export function verifyReferenceVerificationToken(token: string, now = Date.now()): TokenVerificationResult {
  const secret = getVerificationSecret();
  if (!secret) return { ok: false, reason: "configuration_error" };

  const [encodedPayload, providedSignature, extra] = token.split(".");
  if (!encodedPayload || !providedSignature || extra) return { ok: false, reason: "invalid" };

  const expectedSignature = sign(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const payload: unknown = JSON.parse(decoded);
    if (!isPayload(payload)) return { ok: false, reason: "invalid" };
    if (payload.expiresAt <= Math.floor(now / 1000)) return { ok: false, reason: "expired" };
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
