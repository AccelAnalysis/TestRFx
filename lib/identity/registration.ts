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
  campaign?: string;
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

export type RegistrationVerificationRequired = {
  status: "verification_required";
  registrationId: string;
  email: string;
  maskedEmail: string;
  resolution: "new_account" | "pending_verification";
  nextStep: "account_verification";
  handoffHref: string;
  context: RegistrationEntryContext;
  delivery: "sent" | "already_sent";
  retryAfterSeconds?: number;
};

export type RegistrationExistingAccount = {
  status: "existing_account";
  email: string;
  loginHref: string;
  context: RegistrationEntryContext;
};

export type RegistrationDeliveryFailed = {
  status: "verification_delivery_failed";
  registrationId: string;
  email: string;
  maskedEmail: string;
  handoffHref: string;
  context: RegistrationEntryContext;
  message: string;
};

export type RegistrationAccepted =
  | RegistrationVerificationRequired
  | RegistrationExistingAccount
  | RegistrationDeliveryFailed;

export type RegistrationValidationResult =
  | { ok: true; submission: RegistrationSubmission }
  | { ok: false; errors: RegistrationFieldErrors };

export type RegistrationStatus = {
  registrationId: string;
  state: "pending_verification" | "verified" | "existing_account" | "abandoned" | "blocked";
  maskedEmail: string;
  context: RegistrationEntryContext;
  handoffHref: string;
};

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
const contextKeys = ["source", "campaign", "referral", "invitation", "organization", "membership", "geography", "record"] as const;

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
  if (context.campaign) return "campaign";
  const explicit = normalizedKind(requestedKind);
  if (explicit !== "direct") return explicit;
  return context.source === "marketing" ? "marketing" : "direct";
}

export function registrationContextFromSearchParams(params: SearchParamsLike): RegistrationEntryContext {
  const context = {
    returnTo: safeReturnTo(single(params.returnTo)),
    source: clean(single(params.source)) || undefined,
    campaign: clean(single(params.campaign)) || undefined,
    referral: clean(single(params.referral)) || undefined,
    invitation: clean(single(params.invitation) ?? single(params.invite), 500) || undefined,
    organization: clean(single(params.organization)) || undefined,
    membership: clean(single(params.membership)) || undefined,
    geography: clean(single(params.geography)) || undefined,
    record: clean(single(params.record)) || undefined,
  };

  return {
    entryKind: deriveEntryKind(context, single(params.entryKind)),
    ...context,
  };
}

export function registrationContextFromUrlSearchParams(params: URLSearchParams): RegistrationEntryContext {
  return registrationContextFromSearchParams(Object.fromEntries(params.entries()));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeContext(value: unknown): RegistrationEntryContext {
  if (!isRecord(value)) return { entryKind: "direct" };

  const context = {
    returnTo: safeReturnTo(value.returnTo),
    source: clean(value.source) || undefined,
    campaign: clean(value.campaign) || undefined,
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

export function registrationHandoffHref(registrationId: string, context: RegistrationEntryContext, mode?: "resend" | "change-email") {
  const params = registrationContextSearchParams(context);
  params.set("registration", registrationId);
  if (mode) params.set("mode", mode);
  return `/onboarding/account-verification?${params.toString()}`;
}

export function registrationWorkflowHref(
  path: readonly string[],
  context: RegistrationEntryContext,
  registrationId?: string,
) {
  const params = registrationContextSearchParams(context);
  if (registrationId) params.set("registration", registrationId);
  const query = params.toString();
  const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");
  const pathname = `${basePath}/register/${path.map((part) => encodeURIComponent(part)).join("/")}`;
  return query ? `${pathname}?${query}` : pathname;
}
