export type RegistrationEntryKind =
  | "direct"
  | "marketing"
  | "campaign"
  | "referral"
  | "partner_invitation"
  | "event_qr"
  | "login_recovery";

export type RegistrationEntryContext = {
  entryKind: RegistrationEntryKind;
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

export type RegistrationSubmission = {
  firstName: string;
  lastName: string;
  email: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
  context: RegistrationEntryContext;
};

export type RegistrationFieldErrors = Partial<
  Record<"firstName" | "lastName" | "email" | "acceptedTerms" | "form", string>
>;

export type RegistrationAccepted = {
  status: "verification_required";
  registrationId: string;
  email: string;
  nextStep: "account_verification";
  handoffHref: string;
  context: RegistrationEntryContext;
  adapter: "reference";
};

export type RegistrationValidationResult =
  | { ok: true; submission: RegistrationSubmission }
  | { ok: false; errors: RegistrationFieldErrors };

type SearchParamsLike = Record<string, string | string[] | undefined>;

const supportedKinds = new Set<RegistrationEntryKind>([
  "direct",
  "marketing",
  "campaign",
  "referral",
  "partner_invitation",
  "event_qr",
  "login_recovery",
]);
const authEntryPaths = new Set(["/auth", "/signin", "/join", "/login", "/register"]);
const internalOrigin = "https://rfxchange.invalid";
const contextKeys = [
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

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnTo(value: unknown) {
  const candidate = clean(value, 500);
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) return undefined;

  try {
    const destination = new URL(candidate, internalOrigin);
    if (destination.origin !== internalOrigin || authEntryPaths.has(destination.pathname)) return undefined;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return undefined;
  }
}

function normalizedKind(value: unknown): RegistrationEntryKind {
  const candidate = clean(value);
  return supportedKinds.has(candidate as RegistrationEntryKind) ? candidate as RegistrationEntryKind : "direct";
}

function deriveEntryKind(context: Omit<RegistrationEntryContext, "entryKind">, requestedKind?: unknown): RegistrationEntryKind {
  if (context.invitation) return "partner_invitation";
  if (context.referral) return "referral";
  if (context.campaign || context.partner) return "campaign";
  const explicit = normalizedKind(requestedKind);
  if (explicit !== "direct") return explicit;
  return context.source === "marketing" ? "marketing" : "direct";
}

export function registrationContextFromSearchParams(params: SearchParamsLike): RegistrationEntryContext {
  const context = {
    returnTo: safeReturnTo(single(params.returnTo)),
    source: clean(single(params.utm_source) ?? single(params.source)) || undefined,
    medium: clean(single(params.utm_medium) ?? single(params.medium)) || undefined,
    campaign: clean(single(params.campaign) ?? single(params.utm_campaign)) || undefined,
    content: clean(single(params.utm_content) ?? single(params.content)) || undefined,
    partner: clean(single(params.partner)) || undefined,
    referral: clean(single(params.referral) ?? single(params.ref)) || undefined,
    invitation: clean(single(params.invitation) ?? single(params.invite), 500) || undefined,
    organization: clean(single(params.organization)) || undefined,
    membership: clean(single(params.membership)) || undefined,
    geography: clean(single(params.geography)) || undefined,
    record: clean(single(params.record) ?? single(params.opportunity)) || undefined,
  };

  return {
    entryKind: deriveEntryKind(context, single(params.entryKind)),
    ...context,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeContext(value: unknown): RegistrationEntryContext {
  if (!isRecord(value)) return { entryKind: "direct" };

  const context = {
    returnTo: safeReturnTo(value.returnTo),
    source: clean(value.source) || undefined,
    medium: clean(value.medium) || undefined,
    campaign: clean(value.campaign) || undefined,
    content: clean(value.content) || undefined,
    partner: clean(value.partner) || undefined,
    referral: clean(value.referral) || undefined,
    invitation: clean(value.invitation, 500) || undefined,
    organization: clean(value.organization) || undefined,
    membership: clean(value.membership) || undefined,
    geography: clean(value.geography) || undefined,
    record: clean(value.record) || undefined,
  };

  return {
    entryKind: deriveEntryKind(context, value.entryKind),
    ...context,
  };
}

export function validateRegistrationPayload(value: unknown): RegistrationValidationResult {
  if (!isRecord(value)) {
    return { ok: false, errors: { form: "Registration details are required." } };
  }

  const firstName = clean(value.firstName, 80);
  const lastName = clean(value.lastName, 80);
  const email = clean(value.email, 254).toLowerCase();
  const acceptedTerms = value.acceptedTerms === true;
  const marketingConsent = value.marketingConsent === true;
  const errors: RegistrationFieldErrors = {};

  if (!firstName) errors.firstName = "Enter your first name.";
  if (!lastName) errors.lastName = "Enter your last name.";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email address.";
  if (!acceptedTerms) errors.acceptedTerms = "Accept the Terms of Use and Privacy Policy to continue.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    submission: {
      firstName,
      lastName,
      email,
      acceptedTerms,
      marketingConsent,
      context: sanitizeContext(value.context),
    },
  };
}

export function registrationContextSearchParams(context: RegistrationEntryContext) {
  const params = new URLSearchParams();
  if (context.returnTo) params.set("returnTo", context.returnTo);
  for (const key of contextKeys) {
    const value = context[key];
    if (value) params.set(key, value);
  }
  return params;
}

export function registrationLoginHref(context: RegistrationEntryContext) {
  const params = registrationContextSearchParams(context);
  const query = params.toString();
  return query ? `/login?${query}` : "/login";
}

export function registrationHandoffHref(registrationId: string, context: RegistrationEntryContext) {
  const params = registrationContextSearchParams(context);
  params.set("step", "account-verification");
  params.set("registration", registrationId);
  return `/onboarding?${params.toString()}`;
}
