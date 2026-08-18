import { timingSafeEqual } from "crypto";

export interface ResolvedExchangeActor {
  userId: string;
  organizationId: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ExchangeAuthenticationError extends Error {
  constructor(message = "An authenticated RFxchange user and active organization are required.") {
    super(message);
    this.name = "ExchangeAuthenticationError";
  }
}

function sameSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function resolveExchangeActor(headers: Headers): ResolvedExchangeActor {
  // Production actor headers are accepted only when the trusted Identity/BFF layer also
  // supplies a server-held shared secret. Edge infrastructure must strip user-supplied
  // x-rfx-* headers and inject these values after session validation.
  if (process.env.NODE_ENV === "production") {
    const configuredSecret = process.env.RFXCHANGE_TRUSTED_ACTOR_SECRET;
    const presentedSecret = headers.get("x-rfx-actor-secret");
    if (!configuredSecret || !presentedSecret || !sameSecret(configuredSecret, presentedSecret)) {
      throw new ExchangeAuthenticationError("Trusted RFxchange actor context was not established by the Identity/BFF layer.");
    }
  }

  const userId = headers.get("x-rfx-user-id") ?? (process.env.NODE_ENV !== "production" ? process.env.RFXCHANGE_DEV_USER_ID : undefined);
  const organizationId = headers.get("x-rfx-organization-id") ?? (process.env.NODE_ENV !== "production" ? process.env.RFXCHANGE_DEV_ORGANIZATION_ID : undefined);
  if (!userId || !organizationId || !uuid.test(userId) || !uuid.test(organizationId)) throw new ExchangeAuthenticationError();
  return { userId, organizationId };
}
