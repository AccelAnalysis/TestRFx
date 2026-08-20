export type AuthEntryIntent = "signin" | "register" | "choose";

export type AuthEntrySearchParams = Record<string, string | string[] | undefined>;

export type AuthEntryContext = {
  returnTo?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  partner?: string;
  referral?: string;
  invitation?: string;
  organization?: string;
  membership?: string;
  geography?: string;
  record?: string;
};

const CONTEXT_KEYS = [
  "returnTo",
  "source",
  "medium",
  "campaign",
  "content",
  "partner",
  "referral",
  "invitation",
  "organization",
  "membership",
  "geography",
  "record",
] as const;

const ENTRY_PATHS = new Set(["/auth", "/signin", "/join", "/login", "/register"]);
const INTERNAL_ORIGIN = "https://rfxchange.invalid";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function compact(value: string | undefined, maxLength = 180) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, maxLength);
}

export function sanitizeReturnTo(value: string | undefined) {
  const candidate = compact(value, 500);
  if (!candidate) return undefined;
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return undefined;

  try {
    const destination = new URL(candidate, INTERNAL_ORIGIN);
    if (destination.origin !== INTERNAL_ORIGIN) return undefined;
    if (ENTRY_PATHS.has(destination.pathname)) return undefined;

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return undefined;
  }
}

export function parseAuthEntryContext(searchParams: AuthEntrySearchParams): AuthEntryContext {
  return {
    returnTo: sanitizeReturnTo(first(searchParams.returnTo)),
    source: compact(first(searchParams.utm_source) ?? first(searchParams.source)),
    medium: compact(first(searchParams.utm_medium) ?? first(searchParams.medium)),
    campaign: compact(first(searchParams.campaign) ?? first(searchParams.utm_campaign)),
    content: compact(first(searchParams.utm_content) ?? first(searchParams.content)),
    partner: compact(first(searchParams.partner)),
    referral: compact(first(searchParams.referral) ?? first(searchParams.ref)),
    invitation: compact(first(searchParams.invitation), 500),
    organization: compact(first(searchParams.organization)),
    membership: compact(first(searchParams.membership)),
    geography: compact(first(searchParams.geography)),
    record: compact(first(searchParams.record) ?? first(searchParams.opportunity)),
  };
}

export function hasAuthEntryContext(context: AuthEntryContext) {
  return CONTEXT_KEYS.some((key) => Boolean(context[key]));
}

export function authContextSearchParams(context: AuthEntryContext) {
  const params = new URLSearchParams();

  for (const key of CONTEXT_KEYS) {
    const value = context[key];
    if (value) params.set(key, value);
  }

  return params;
}

export function withAuthEntryContext(path: string, context: AuthEntryContext) {
  const params = authContextSearchParams(context);
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildIdentityHref(intent: Exclude<AuthEntryIntent, "choose">, context: AuthEntryContext) {
  return withAuthEntryContext(intent === "signin" ? "/login" : "/register", context);
}

export function buildPublicAuthHref(intent: AuthEntryIntent, context: AuthEntryContext = {}) {
  const path = intent === "signin" ? "/signin" : intent === "register" ? "/join" : "/auth";
  return withAuthEntryContext(path, context);
}

export function buildOnboardingHref(context: AuthEntryContext) {
  return withAuthEntryContext("/onboarding", context);
}

export function resolveAuthenticatedDestination(context: AuthEntryContext) {
  return context.returnTo ?? "/exchange";
}

export function describeAuthEntryContext(context: AuthEntryContext) {
  const details: Array<{ label: string; value: string }> = [];

  if (context.membership) details.push({ label: "Membership", value: context.membership });
  if (context.organization) details.push({ label: "Organization", value: context.organization });
  if (context.geography) details.push({ label: "Geography", value: context.geography });
  if (context.record) details.push({ label: "Requested record", value: context.record });
  if (context.campaign) details.push({ label: "Campaign", value: context.campaign });
  if (context.partner) details.push({ label: "Partner", value: context.partner });
  if (context.referral) details.push({ label: "Referral", value: context.referral });
  if (context.source) details.push({ label: "Source", value: context.source });
  if (context.medium) details.push({ label: "Medium", value: context.medium });
  if (context.invitation) details.push({ label: "Invitation", value: "Invitation context retained" });
  if (context.returnTo) details.push({ label: "Continue to", value: context.returnTo });

  return details;
}
