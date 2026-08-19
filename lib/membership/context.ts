import type { MembershipActorContext } from "@/lib/membership/contracts";
import { MembershipServiceError } from "@/lib/membership/contracts";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import {
  readRfxSessionFromCookieHeader,
  RFX_SESSION_COOKIE,
} from "@/lib/server/onboarding/actor";

// Membership consumes the same signed active-organization session used by the
// rest of the authenticated RFxchange runtime. PostgreSQL membership checks in
// the Membership repository remain authoritative for every protected action.
export const MEMBERSHIP_CONTEXT_COOKIE = RFX_SESSION_COOKIE;

export function readMembershipContext(cookieHeader: string | null): MembershipActorContext {
  let session;
  try {
    session = readRfxSessionFromCookieHeader(cookieHeader);
  } catch (error) {
    if (error instanceof DatabaseServiceUnavailableError) {
      throw new MembershipServiceError(
        "MEMBERSHIP_SESSION_NOT_CONFIGURED",
        "The authenticated RFxchange organization session is not configured for this runtime.",
        503,
      );
    }
    throw error;
  }

  if (!session) {
    throw new MembershipServiceError(
      "MEMBERSHIP_CONTEXT_REQUIRED",
      "Complete account and organization onboarding before managing paid membership.",
      401,
    );
  }

  return {
    userId: session.userId,
    organizationId: session.organizationId,
    issuedAt: Math.floor(Date.now() / 1000),
    expiresAt: Math.floor(session.expiresAt / 1000),
  };
}
