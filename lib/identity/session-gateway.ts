import type { AuthenticatedIdentityContext, IdentityReadinessSnapshot } from "./contracts";

export const SESSION_COOKIE_NAME = "rfx_session";

export class IdentitySessionUnavailableError extends Error {
  constructor(message = "RFxchange session service is not configured.") {
    super(message);
    this.name = "IdentitySessionUnavailableError";
  }
}

export class IdentitySessionUnauthorizedError extends Error {
  constructor(message = "RFxchange session is invalid or expired.") {
    super(message);
    this.name = "IdentitySessionUnauthorizedError";
  }
}

function isReadiness(value: unknown): value is IdentityReadinessSnapshot {
  if (!value || typeof value !== "object") return false;
  const raw = value as Record<string, unknown>;
  return [
    "accountVerified",
    "organizationSelected",
    "geographyComplete",
    "organizationProfileComplete",
    "capabilityProfileStarted",
    "membershipAccessSatisfied",
    "exchangeReady",
    "restricted",
  ].every((key) => typeof raw[key] === "boolean");
}

function sessionEndpoint() {
  const value = process.env.RFXCHANGE_IDENTITY_SESSION_ENDPOINT?.trim();
  if (!value) {
    throw new IdentitySessionUnavailableError(
      "Session resolution requires RFXCHANGE_IDENTITY_SESSION_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new IdentitySessionUnavailableError(
      "RFXCHANGE_IDENTITY_SESSION_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new IdentitySessionUnavailableError(
      "RFXCHANGE_IDENTITY_SESSION_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new IdentitySessionUnavailableError(
      "Production session resolution requires an HTTPS identity endpoint.",
    );
  }

  return endpoint;
}

export async function resolveIdentitySession(sessionToken: string): Promise<AuthenticatedIdentityContext> {
  if (!sessionToken.trim()) throw new IdentitySessionUnauthorizedError();

  const response = await fetch(sessionEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RFXCHANGE_IDENTITY_SESSION_TOKEN?.trim()
        ? { Authorization: `Bearer ${process.env.RFXCHANGE_IDENTITY_SESSION_TOKEN.trim()}` }
        : {}),
    },
    body: JSON.stringify({ sessionToken }),
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    throw new IdentitySessionUnauthorizedError();
  }
  if (!response.ok) {
    throw new Error(`Identity session provider rejected the request (${response.status}).`);
  }

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  const activeOrganizationId = typeof payload?.activeOrganizationId === "string"
    ? payload.activeOrganizationId.trim()
    : "";

  if (!userId || !isReadiness(payload?.readiness)) {
    throw new Error("Identity session provider returned an incomplete identity context.");
  }

  return {
    userId: userId.slice(0, 240),
    activeOrganizationId: activeOrganizationId ? activeOrganizationId.slice(0, 240) : undefined,
    readiness: payload.readiness,
  };
}
