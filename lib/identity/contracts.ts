export type MagicLinkDeliveryMode = "provider";

export interface MagicLinkRequestInput {
  email: string;
  returnTo: string;
  userAgent?: string;
}

export interface MagicLinkRequestResult {
  delivery: MagicLinkDeliveryMode;
  expiresInSeconds: number;
}

export interface MagicLinkChallengeAccepted {
  status: "challenge_sent";
  delivery: MagicLinkDeliveryMode;
  expiresInSeconds: number;
  returnTo: string;
}

export interface LoginApiError {
  error: string;
  code: "invalid_request" | "provider_unavailable" | "request_failed";
}

export interface IdentityReadinessSnapshot {
  accountVerified: boolean;
  organizationSelected: boolean;
  geographyComplete: boolean;
  organizationProfileComplete: boolean;
  capabilityProfileStarted: boolean;
  membershipAccessSatisfied: boolean;
  exchangeReady: boolean;
  restricted: boolean;
}

export interface AuthenticatedIdentityContext {
  userId: string;
  activeOrganizationId?: string;
  readiness: IdentityReadinessSnapshot;
}
