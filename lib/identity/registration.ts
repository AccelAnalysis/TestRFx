export type RegistrationEntrySource =
  | "direct"
  | "marketing"
  | "campaign"
  | "referral"
  | "partner_invitation"
  | "event_qr"
  | "login_recovery";

export type RegistrationEntryContext = {
  source: RegistrationEntrySource;
  sourceDetail?: string;
  campaign?: string;
  referralCode?: string;
  invitationCode?: string;
  returnTo?: string;
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

const supportedSources = new Set<RegistrationEntrySource>([
  "direct",
  "marketing",
  "campaign",
  "referral",
  "partner_invitation",
  "event_qr",
  "login_recovery",
]);

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: unknown, maxLength = 160) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnTo(value: unknown) {
  const candidate = clean(value, 240);
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : undefined;
}

function normalizedSource(value: string | undefined): RegistrationEntrySource {
  if (value && supportedSources.has(value as RegistrationEntrySource)) {
    return value as RegistrationEntrySource;
  }
  return "direct";
}

export function registrationContextFromSearchParams(params: SearchParamsLike): RegistrationEntryContext {
  const invitationCode = clean(single(params.invite));
  const referralCode = clean(single(params.referral));
  const campaign = clean(single(params.campaign));
  const sourceParam = clean(single(params.source));

  const source: RegistrationEntrySource = invitationCode
    ? "partner_invitation"
    : referralCode
      ? "referral"
      : campaign
        ? "campaign"
        : normalizedSource(sourceParam || undefined);

  return {
    source,
    ...(sourceParam && sourceParam !== source ? { sourceDetail: sourceParam } : {}),
    ...(campaign ? { campaign } : {}),
    ...(referralCode ? { referralCode } : {}),
    ...(invitationCode ? { invitationCode } : {}),
    ...(safeReturnTo(single(params.returnTo)) ? { returnTo: safeReturnTo(single(params.returnTo)) } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeContext(value: unknown): RegistrationEntryContext {
  if (!isRecord(value)) return { source: "direct" };

  const source = normalizedSource(clean(value.source) || undefined);
  const sourceDetail = clean(value.sourceDetail);
  const campaign = clean(value.campaign);
  const referralCode = clean(value.referralCode);
  const invitationCode = clean(value.invitationCode);
  const returnTo = safeReturnTo(value.returnTo);

  return {
    source,
    ...(sourceDetail ? { sourceDetail } : {}),
    ...(campaign ? { campaign } : {}),
    ...(referralCode ? { referralCode } : {}),
    ...(invitationCode ? { invitationCode } : {}),
    ...(returnTo ? { returnTo } : {}),
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

export function registrationHandoffHref(registrationId: string, context: RegistrationEntryContext) {
  const params = new URLSearchParams({ step: "account-verification", registration: registrationId });
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return `/onboarding?${params.toString()}`;
}
