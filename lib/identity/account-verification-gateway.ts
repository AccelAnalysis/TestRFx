import {
  ACCOUNT_VERIFICATION_TTL_SECONDS,
  type AccountVerificationContext,
  sanitizeVerificationContext,
} from "./account-verification";

export class AccountVerificationProviderUnavailableError extends Error {
  constructor(message = "RFxchange account verification provider is not configured.") {
    super(message);
    this.name = "AccountVerificationProviderUnavailableError";
  }
}

export type VerificationRequestAction = "request" | "resend" | "change_email";

export type VerificationProviderResult =
  | {
      state: "pending";
      expiresInSeconds: number;
    }
  | {
      state: "verified";
      email: string;
      context: AccountVerificationContext;
    }
  | {
      state: "expired" | "invalid";
    };

export interface AccountVerificationGateway {
  requestChallenge(input: {
    action: VerificationRequestAction;
    email: string;
    context: AccountVerificationContext;
  }): Promise<VerificationProviderResult>;
  verifyChallenge(token: string): Promise<VerificationProviderResult>;
}

class HttpAccountVerificationGateway implements AccountVerificationGateway {
  constructor(
    private readonly endpoint: URL,
    private readonly bearerToken?: string,
  ) {}

  private async call(body: Record<string, unknown>): Promise<VerificationProviderResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.bearerToken ? { Authorization: `Bearer ${this.bearerToken}` } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !payload) {
      throw new Error(`Account verification provider rejected the request (${response.status}).`);
    }

    if (payload.state === "pending") {
      const ttl = typeof payload.expiresInSeconds === "number" && Number.isFinite(payload.expiresInSeconds) && payload.expiresInSeconds > 0
        ? Math.round(payload.expiresInSeconds)
        : ACCOUNT_VERIFICATION_TTL_SECONDS;
      return { state: "pending", expiresInSeconds: ttl };
    }

    if (payload.state === "verified" && typeof payload.email === "string") {
      return {
        state: "verified",
        email: payload.email,
        context: sanitizeVerificationContext(payload.context),
      };
    }

    if (payload.state === "expired" || payload.state === "invalid") {
      return { state: payload.state };
    }

    throw new Error("Account verification provider returned an unsupported response state.");
  }

  requestChallenge(input: {
    action: VerificationRequestAction;
    email: string;
    context: AccountVerificationContext;
  }) {
    return this.call({
      action: input.action,
      email: input.email,
      context: input.context,
    });
  }

  verifyChallenge(token: string) {
    return this.call({ action: "verify", token });
  }
}

function verificationEndpoint() {
  const value = process.env.RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT?.trim();
  if (!value) {
    throw new AccountVerificationProviderUnavailableError(
      "Account verification requires RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new AccountVerificationProviderUnavailableError(
      "RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new AccountVerificationProviderUnavailableError(
      "RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new AccountVerificationProviderUnavailableError(
      "Production account verification requires an HTTPS identity endpoint.",
    );
  }

  return endpoint;
}

export function getAccountVerificationGateway(): AccountVerificationGateway {
  return new HttpAccountVerificationGateway(
    verificationEndpoint(),
    process.env.RFXCHANGE_IDENTITY_VERIFICATION_TOKEN?.trim() || undefined,
  );
}
