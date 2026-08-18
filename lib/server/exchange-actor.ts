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

export function resolveExchangeActor(headers: Headers): ResolvedExchangeActor {
  // In production these headers must be injected by the trusted RFxchange auth/BFF layer.
  // Development environment values are server-side only; the request body is never trusted
  // to choose the actor or organization.
  const userId = headers.get("x-rfx-user-id") ?? (process.env.NODE_ENV !== "production" ? process.env.RFXCHANGE_DEV_USER_ID : undefined);
  const organizationId = headers.get("x-rfx-organization-id") ?? (process.env.NODE_ENV !== "production" ? process.env.RFXCHANGE_DEV_ORGANIZATION_ID : undefined);
  if (!userId || !organizationId || !uuid.test(userId) || !uuid.test(organizationId)) throw new ExchangeAuthenticationError();
  return { userId, organizationId };
}
