import type { RegistrationSubmission } from "./registration";

export class RegistrationProviderUnavailableError extends Error {
  constructor(message = "RFxchange registration provider is not configured.") {
    super(message);
    this.name = "RegistrationProviderUnavailableError";
  }
}

export type PendingRegistration = {
  registrationId: string;
};

export interface RegistrationGateway {
  createPendingRegistration(submission: RegistrationSubmission): Promise<PendingRegistration>;
}

class HttpRegistrationGateway implements RegistrationGateway {
  constructor(
    private readonly endpoint: URL,
    private readonly bearerToken?: string,
  ) {}

  async createPendingRegistration(submission: RegistrationSubmission): Promise<PendingRegistration> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {}),
      },
      body: JSON.stringify(submission),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Registration provider rejected the request (${response.status}).`);
    }

    const payload = (await response.json().catch(() => null)) as { registrationId?: unknown } | null;
    const registrationId = typeof payload?.registrationId === "string" ? payload.registrationId.trim() : "";
    if (!registrationId) {
      throw new Error("Registration provider did not return a registrationId.");
    }

    return { registrationId: registrationId.slice(0, 180) };
  }
}

function registrationEndpoint() {
  const value = process.env.RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT?.trim();
  if (!value) {
    throw new RegistrationProviderUnavailableError(
      "Registration requires RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new RegistrationProviderUnavailableError(
      "RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new RegistrationProviderUnavailableError(
      "RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new RegistrationProviderUnavailableError(
      "Production registration requires an HTTPS identity endpoint.",
    );
  }

  return endpoint;
}

export function getRegistrationGateway(): RegistrationGateway {
  return new HttpRegistrationGateway(
    registrationEndpoint(),
    process.env.RFXCHANGE_IDENTITY_REGISTRATION_TOKEN?.trim() || undefined,
  );
}
