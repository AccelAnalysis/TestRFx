export interface MagicLinkRequestInput {
  email: string;
  continueUrl: string;
  rememberDevice: boolean;
  userAgent?: string;
  ipAddress?: string;
  country?: string;
}

export interface MagicLinkRequestResult {
  challengeId: string;
  expiresInSeconds: number;
}

export interface MagicLinkChallengeAccepted {
  status: "challenge_sent";
  challengeId: string;
  expiresInSeconds: number;
}

export type LoginApiErrorCode =
  | "invalid_request"
  | "account_not_found"
  | "account_restricted"
  | "rate_limited"
  | "provider_unavailable"
  | "request_failed";

export interface LoginApiError {
  error: string;
  code: LoginApiErrorCode;
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
  firebaseUid: string;
  userId: string;
  activeOrganizationId?: string;
  organizationRole?: string;
  permissions: string[];
  readiness: IdentityReadinessSnapshot;
}

export interface SessionCreationResult {
  sessionCookie: string;
  expiresAt: number;
  destination: string;
  identity: AuthenticatedIdentityContext;
}
