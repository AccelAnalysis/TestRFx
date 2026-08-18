import type { IdentityReadinessSnapshot } from "./contracts";
import { sanitizeReturnTo } from "./login";

export function resolvePostLoginDestination(readiness: IdentityReadinessSnapshot, returnTo?: string | null): string {
  if (readiness.restricted) return "/login/restricted";
  if (!readiness.accountVerified) return "/onboarding/account-verification";
  if (!readiness.organizationSelected) return "/onboarding/organization";
  if (!readiness.geographyComplete) return "/onboarding/geography";
  if (!readiness.organizationProfileComplete) return "/onboarding/organization-profile";
  if (!readiness.capabilityProfileStarted) return "/onboarding/capabilities";
  if (!readiness.membershipAccessSatisfied) return "/onboarding/membership";
  if (!readiness.exchangeReady) return "/onboarding/completion";
  return sanitizeReturnTo(returnTo);
}
