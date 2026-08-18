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
  userId: string;
  activeOrganizationId?: string;
  readiness: IdentityReadinessSnapshot;
}

export type MagicLinkVerificationInput =
  | { token: string; userAgent?: string }
  | { challengeId: string; code: string; userAgent?: string };

export type MagicLinkVerificationResult =
  | {
      state: "authenticated";
      sessionToken: string;
      expiresInSeconds: number;
      returnTo?: string;
      identity: AuthenticatedIdentityContext;
    }
  | {
      state: "mfa_required";
      challengeId: string;
    }
  | {
      state: "expired" | "invalid" | "restricted";
    };

export type LoginVerifyApiResponse =
  | {
      state: "authenticated";
      nextPath: string;
    }
  | {
      state: "mfa_required";
      challengeId: string;
    }
  | {
      state: "expired" | "invalid" | "restricted";
      message: string;
    };
