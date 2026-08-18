export const ACCOUNT_VERIFICATION_TTL_SECONDS = 30 * 60;

export type AccountVerificationState =
  | "idle"
  | "loading"
  | "requesting"
  | "pending"
  | "verifying"
  | "verified"
  | "expired"
  | "invalid"
  | "configuration_error";

export type VerificationChallengeState =
  | "issued"
  | "consumed"
  | "expired"
  | "revoked"
  | "superseded";

export type VerificationEntrySource =
  | "registration"
  | "email_change"
  | "resend"
  | "invitation"
  | "referral"
  | "campaign"
  | "unknown";

export interface AccountVerificationContext {
  source?: VerificationEntrySource;
  acquisitionSource?: string;
  invitation?: string;
  referral?: string;
  campaign?: string;
  organization?: string;
  membership?: string;
  geography?: string;
  record?: string;
  returnTo?: string;
}

export interface VerificationRequestResponse {
  state: "pending";
  registrationId: string;
  maskedEmail: string;
  expiresInSeconds: number;
  retryAfterSeconds?: number;
}

export interface VerificationSuccessResponse {
  state: "verified";
  registrationId: string;
  maskedEmail: string;
  nextPath: string;
  context: AccountVerificationContext;
}

export interface VerificationStatusResponse {
  state: "pending" | "verified";
  registrationId: string;
  maskedEmail: string;
  latestDeliveryState?: "pending" | "sent" | "failed";
  latestChallengeState?: VerificationChallengeState;
  nextPath?: string;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isPlausibleEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function maskEmail(value: string): string {
  const normalized = normalizeEmail(value);
  const at = normalized.indexOf("@");
  if (at <= 0) return normalized;

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, Math.min(6, local.length - visible.length)))}@${domain}`;
}

function boundedValue(value: unknown, maxLength = 240): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function isInternalReturnPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && (value.startsWith("/onboarding") || value.startsWith("/exchange"));
}

const allowedSources = new Set<VerificationEntrySource>([
  "registration",
  "email_change",
  "resend",
  "invitation",
  "referral",
  "campaign",
  "unknown",
]);

export function sanitizeVerificationContext(value: unknown): AccountVerificationContext {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const sourceValue = boundedValue(raw.source);
  const returnTo = boundedValue(raw.returnTo, 500);

  return {
    source: sourceValue && allowedSources.has(sourceValue as VerificationEntrySource)
      ? (sourceValue as VerificationEntrySource)
      : undefined,
    acquisitionSource: boundedValue(raw.acquisitionSource),
    invitation: boundedValue(raw.invitation, 500),
    referral: boundedValue(raw.referral),
    campaign: boundedValue(raw.campaign),
    organization: boundedValue(raw.organization),
    membership: boundedValue(raw.membership),
    geography: boundedValue(raw.geography),
    record: boundedValue(raw.record),
    returnTo: returnTo && isInternalReturnPath(returnTo) ? returnTo : undefined,
  };
}

export function verificationContextFromSearchParams(params: URLSearchParams): AccountVerificationContext {
  return sanitizeVerificationContext({
    source: params.get("source") ?? undefined,
    acquisitionSource: params.get("acquisitionSource") ?? undefined,
    invitation: params.get("invitation") ?? params.get("invite") ?? undefined,
    referral: params.get("referral") ?? undefined,
    campaign: params.get("campaign") ?? undefined,
    organization: params.get("organization") ?? undefined,
    membership: params.get("membership") ?? undefined,
    geography: params.get("geography") ?? undefined,
    record: params.get("record") ?? undefined,
    returnTo: params.get("returnTo") ?? undefined,
  });
}

export function buildVerificationContextSearchParams(context: AccountVerificationContext): URLSearchParams {
  const params = new URLSearchParams();
  if (context.source) params.set("source", context.source);
  if (context.acquisitionSource) params.set("acquisitionSource", context.acquisitionSource);
  if (context.invitation) params.set("invitation", context.invitation);
  if (context.referral) params.set("referral", context.referral);
  if (context.campaign) params.set("campaign", context.campaign);
  if (context.organization) params.set("organization", context.organization);
  if (context.membership) params.set("membership", context.membership);
  if (context.geography) params.set("geography", context.geography);
  if (context.record) params.set("record", context.record);
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return params;
}

export function buildOnboardingContinuation(context: AccountVerificationContext): string {
  const params = buildVerificationContextSearchParams(context);
  const query = params.toString();
  return query ? `/onboarding/organization?${query}` : "/onboarding/organization";
}

export function sourceFromRegistrationContext(entryKind: string): VerificationEntrySource {
  if (entryKind === "partner_invitation") return "invitation";
  if (entryKind === "referral") return "referral";
  if (entryKind === "campaign") return "campaign";
  return "registration";
}
