import { createHmac, timingSafeEqual } from "node:crypto";
import type { MembershipActorContext } from "@/lib/membership/contracts";
import { MembershipServiceError } from "@/lib/membership/contracts";

export const MEMBERSHIP_CONTEXT_COOKIE = "rfxchange_membership_context";
const CONTEXT_VERSION = 1;
const DEFAULT_TTL_SECONDS = 60 * 60 * 4;

type SignedPayload = MembershipActorContext & { v: number };

function contextSecret(): string {
  const secret = process.env.RFXCHANGE_MEMBERSHIP_CONTEXT_SECRET?.trim();
  if (!secret) {
    throw new MembershipServiceError(
      "MEMBERSHIP_CONTEXT_NOT_CONFIGURED",
      "Secure organization membership context is not configured for this runtime.",
      503,
    );
  }
  return secret;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(encodedPayload: string): string {
  return createHmac("sha256", contextSecret()).update(encodedPayload).digest("base64url");
}

export function issueMembershipContext(
  input: Pick<MembershipActorContext, "userId" | "organizationId">,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): string {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload: SignedPayload = {
    v: CONTEXT_VERSION,
    userId: input.userId,
    organizationId: input.organizationId,
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function membershipContextSetCookie(token: string, maxAgeSeconds = DEFAULT_TTL_SECONDS): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${MEMBERSHIP_CONTEXT_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

function cookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key === name) return valueParts.join("=") || null;
  }
  return null;
}

export function readMembershipContext(cookieHeader: string | null): MembershipActorContext {
  const token = cookieValue(cookieHeader, MEMBERSHIP_CONTEXT_COOKIE);
  if (!token) {
    throw new MembershipServiceError(
      "MEMBERSHIP_CONTEXT_REQUIRED",
      "Complete account and organization onboarding before managing paid membership.",
      401,
    );
  }

  const [encoded, suppliedSignature] = token.split(".");
  if (!encoded || !suppliedSignature) {
    throw new MembershipServiceError("MEMBERSHIP_CONTEXT_INVALID", "Membership context is invalid.", 401);
  }

  const expectedSignature = sign(encoded);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new MembershipServiceError("MEMBERSHIP_CONTEXT_INVALID", "Membership context is invalid.", 401);
  }

  let payload: SignedPayload;
  try {
    payload = JSON.parse(decode(encoded)) as SignedPayload;
  } catch {
    throw new MembershipServiceError("MEMBERSHIP_CONTEXT_INVALID", "Membership context is invalid.", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.v !== CONTEXT_VERSION ||
    !payload.userId ||
    !payload.organizationId ||
    !Number.isFinite(payload.issuedAt) ||
    !Number.isFinite(payload.expiresAt) ||
    payload.expiresAt <= now
  ) {
    throw new MembershipServiceError("MEMBERSHIP_CONTEXT_EXPIRED", "Membership context has expired. Sign in again to continue.", 401);
  }

  return {
    userId: payload.userId,
    organizationId: payload.organizationId,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  };
}
