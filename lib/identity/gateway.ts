import type { MagicLinkRequestInput, MagicLinkRequestResult } from "./contracts";
import { MAGIC_LINK_TTL_SECONDS } from "./login";

export interface IdentityGateway {
  requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult>;
}

export class IdentityProviderUnavailableError extends Error {
  constructor(message = "RFxchange identity delivery is not configured.") {
    super(message);
    this.name = "IdentityProviderUnavailableError";
  }
}

class HttpIdentityGateway implements IdentityGateway {
  constructor(
    private readonly endpoint: URL,
    private readonly bearerToken?: string,
  ) {}

  async requestMagicLink(input: MagicLinkRequestInput): Promise<MagicLinkRequestResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {}),
      },
      body: JSON.stringify({
        email: input.email,
        returnTo: input.returnTo,
        userAgent: input.userAgent,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Identity provider rejected the sign-in challenge (${response.status}).`);
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
      // A successful provider may return no body. The source-defined 15-minute
      // challenge lifetime remains the default contract in that case.
    }

    return {
      delivery: "provider",
      expiresInSeconds,
    };
  }
}

function configuredEndpoint() {
  const value = process.env.RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT?.trim();
  if (!value) {
    throw new IdentityProviderUnavailableError(
      "Magic-link delivery requires RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new IdentityProviderUnavailableError(
      "RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new IdentityProviderUnavailableError(
      "RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new IdentityProviderUnavailableError(
      "Production magic-link delivery requires an HTTPS identity endpoint.",
    );
  }

  return endpoint;
}

export function getIdentityGateway(): IdentityGateway {
  return new HttpIdentityGateway(
    configuredEndpoint(),
    process.env.RFXCHANGE_IDENTITY_MAGIC_LINK_TOKEN?.trim() || undefined,
  );
}
