export const ACCOUNT_VERIFICATION_PURPOSE = "rfxchange-account-email-verification" as const;
export const ACCOUNT_VERIFICATION_TTL_SECONDS = 30 * 60;

export type AccountVerificationState =
  | "idle"
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
  invitationId?: string;
  referralId?: string;
  campaignId?: string;
  returnTo?: string;
}

export interface VerificationTokenPayload {
  version: 1;
  purpose: typeof ACCOUNT_VERIFICATION_PURPOSE;
  email: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  context: AccountVerificationContext;
}

export interface VerificationRequestResponse {
  state: "pending";
  maskedEmail: string;
  expiresInSeconds: number;
}

export interface VerificationSuccessResponse {
  state: "verified";
  email: string;
  nextPath: string;
  context: AccountVerificationContext;
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

function boundedValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 240) return undefined;
  return trimmed;
}

function isInternalReturnPath(value: string): boolean {
  return value.startsWith("/onboarding") || value.startsWith("/exchange");
}

export function sanitizeVerificationContext(value: unknown): AccountVerificationContext {
  if (!value || typeof value !== "object") return {};
  const raw = value as Record<string, unknown>;
  const source = boundedValue(raw.source);
  const allowedSources: VerificationEntrySource[] = [
    "registration",
    "email_change",
    "resend",
    "invitation",
    "referral",
    "campaign",
    "unknown",
  ];
  const returnTo = boundedValue(raw.returnTo);

  return {
    source: allowedSources.includes(source as VerificationEntrySource)
      ? (source as VerificationEntrySource)
      : undefined,
    invitationId: boundedValue(raw.invitationId),
    referralId: boundedValue(raw.referralId),
    campaignId: boundedValue(raw.campaignId),
    returnTo: returnTo && isInternalReturnPath(returnTo) ? returnTo : undefined,
  };
}

export function buildOnboardingContinuation(context: AccountVerificationContext): string {
  const params = new URLSearchParams({ stage: "organization" });
  if (context.source) params.set("source", context.source);
  if (context.invitationId) params.set("invitation", context.invitationId);
  if (context.referralId) params.set("referral", context.referralId);
  if (context.campaignId) params.set("campaign", context.campaignId);
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return `/onboarding?${params.toString()}`;
}
