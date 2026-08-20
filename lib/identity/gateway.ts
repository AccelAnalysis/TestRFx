import type {
  AuthenticatedIdentityContext,
  MagicLinkRequestInput,
  MagicLinkRequestResult,
  MagicLinkVerificationInput,
  MagicLinkVerificationResult,
} from "./contracts";
import { MAGIC_LINK_TTL_SECONDS } from "./login";

export interface IdentityGateway {
  requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult>;
  verifyMagicLink(input: MagicLinkVerificationInput): Promise<MagicLinkVerificationResult>;
}

export class IdentityProviderUnavailableError extends Error {
  constructor(message = "RFxchange identity service is not configured.") {
    super(message);
    this.name = "IdentityProviderUnavailableError";
  }
}

export class IdentityProviderRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "IdentityProviderRequestError";
  }
}

function validReadiness(value: unknown): value is AuthenticatedIdentityContext["readiness"] {
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

function parseEndpoint(value: string | undefined, environmentName: string) {
  const candidate = value?.trim();
  if (!candidate) {
    throw new IdentityProviderUnavailableError(`${environmentName} is required.`);
  }

  let endpoint: URL;
  try {
    endpoint = new URL(candidate);
  } catch {
    throw new IdentityProviderUnavailableError(`${environmentName} must be a valid HTTP(S) URL.`);
  }

  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new IdentityProviderUnavailableError(`${environmentName} must use HTTP(S).`);
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new IdentityProviderUnavailableError(`${environmentName} must use HTTPS in production.`);
  }

  return endpoint;
}

class HttpIdentityGateway implements IdentityGateway {
  constructor(
    private readonly requestEndpoint: URL,
    private readonly verifyEndpoint: URL,
    private readonly bearerToken?: string,
  ) {}

  private headers() {
    return {
      "Content-Type": "application/json",
      ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {}),
    };
  }

  async requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult> {
    const response = await fetch(this.requestEndpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        email: input.email,
        returnTo: input.returnTo,
        callbackUrl: input.callbackUrl,
        userAgent: input.userAgent,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new IdentityProviderRequestError(
        response.status,
        `Identity provider rejected the sign-in challenge (${response.status}).`,
      );
    }

    let expiresInSeconds = MAGIC_LINK_TTL_SECONDS;
    try {
      const payload = (await response.json()) as { expiresInSeconds?: unknown };
      if (
        typeof payload.expiresInSeconds === "number" &&
        Number.isFinite(payload.expiresInSeconds) &&
        payload.expiresInSeconds > 0
      ) {
        expiresInSeconds = Math.round(payload.expiresInSeconds);
      }
    } catch {
      // A successful provider may return no body. The Login source's 15-minute
      // link lifetime remains the default contract in that case.
    }

    return { delivery: "provider", expiresInSeconds };
  }

  async verifyMagicLink(input: MagicLinkVerificationInput): Promise<MagicLinkVerificationResult> {
    const response = await fetch(this.verifyEndpoint, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(input),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;

    if (response.status === 410 || payload?.state === "expired") return { state: "expired" };
    if (response.status === 403 || payload?.state === "restricted") return { state: "restricted" };
    if (response.status === 400 || payload?.state === "invalid") return { state: "invalid" };
    if (!response.ok || !payload) {
      throw new IdentityProviderRequestError(
        response.status,
        `Identity provider rejected verification (${response.status}).`,
      );
    }

    if (payload.state === "mfa_required" && typeof payload.challengeId === "string" && payload.challengeId.trim()) {
      return { state: "mfa_required", challengeId: payload.challengeId.trim().slice(0, 240) };
    }

    if (payload.state !== "authenticated") {
      throw new Error("Identity provider returned an unsupported verification state.");
    }

    const sessionToken = typeof payload.sessionToken === "string" ? payload.sessionToken.trim() : "";
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    if (!sessionToken || !userId || !validReadiness(payload.readiness)) {
      throw new Error("Identity provider did not return a complete authenticated identity response.");
    }

    const expiresInSeconds =
      typeof payload.expiresInSeconds === "number" && Number.isFinite(payload.expiresInSeconds) && payload.expiresInSeconds > 0
        ? Math.round(payload.expiresInSeconds)
        : 60 * 60 * 8;

    const activeOrganizationId =
      typeof payload.activeOrganizationId === "string" && payload.activeOrganizationId.trim()
        ? payload.activeOrganizationId.trim().slice(0, 240)
        : undefined;

    return {
      state: "authenticated",
      sessionToken,
      expiresInSeconds,
      returnTo: typeof payload.returnTo === "string" ? payload.returnTo : undefined,
      identity: {
        userId: userId.slice(0, 240),
        activeOrganizationId,
        readiness: payload.readiness,
      },
    };
  }
}

export function getIdentityGateway(): IdentityGateway {
  return new HttpIdentityGateway(
    parseEndpoint(
      process.env.RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT,
      "RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT",
    ),
    parseEndpoint(
      process.env.RFXCHANGE_IDENTITY_MAGIC_LINK_VERIFY_ENDPOINT,
      "RFXCHANGE_IDENTITY_MAGIC_LINK_VERIFY_ENDPOINT",
    ),
    process.env.RFXCHANGE_IDENTITY_MAGIC_LINK_TOKEN?.trim() || undefined,
  );
}
