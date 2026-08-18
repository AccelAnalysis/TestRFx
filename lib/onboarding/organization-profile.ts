export type OrganizationClaimMode = "claimed" | "created" | "selected";

export type OrganizationRole =
  | "business"
  | "supplier"
  | "buyer"
  | "issuer"
  | "government"
  | "economic_development"
  | "resource_provider"
  | "business_organization"
  | "lender"
  | "education"
  | "nonprofit"
  | "other";

export type OrganizationGoal =
  | "find_opportunities"
  | "issue_opportunities"
  | "find_customers"
  | "find_suppliers"
  | "find_teammates"
  | "referrals"
  | "find_resources"
  | "explore_network";

export type OrganizationProfileContext = {
  organizationId?: string;
  organizationName?: string;
  claimMode: OrganizationClaimMode;
  geography?: string;
  returnTo?: string;
};

export type OrganizationProfileSubmission = {
  context: OrganizationProfileContext;
  displayName: string;
  legalName: string;
  description: string;
  website: string;
  primaryDomain: string;
  industry: string;
  naics: string;
  roles: OrganizationRole[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  brandName: string;
  logoUrl: string;
  searchable: boolean;
  mapVisible: boolean;
  publicContact: boolean;
  goals: OrganizationGoal[];
};

export type OrganizationProfileField =
  | "organization"
  | "displayName"
  | "description"
  | "website"
  | "primaryDomain"
  | "roles"
  | "contactName"
  | "contactEmail"
  | "logoUrl"
  | "goals"
  | "form";

export type OrganizationProfileFieldErrors = Partial<Record<OrganizationProfileField, string>>;

export type OrganizationProfileCompletion = {
  identity: boolean;
  contact: boolean;
  role: boolean;
  visibility: boolean;
  goals: boolean;
};

export type OrganizationProfileAccepted = {
  status: "profile_saved" | "profile_complete";
  organizationId: string;
  organizationName: string;
  nextStep: "capability_enrichment";
  handoffHref: string;
  completion: OrganizationProfileCompletion;
  context: OrganizationProfileContext;
  service: "postgres";
};

export type OrganizationGeographySummary = {
  label: string;
  locality?: string;
  region?: string;
  visibility?: string;
  mapReady: boolean;
  serviceGeographies: string[];
} | null;

export type OrganizationTeamMember = {
  userId: string;
  displayName: string;
  email: string;
  role: string;
  permissions: string[];
  isViewer: boolean;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  status: string;
  expiresAt: string;
  createdAt: string;
};

export type OrganizationVerification = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  value: string;
  status: string;
  source?: string;
  verifiedAt?: string;
  expiresAt?: string;
};

export type OrganizationProfileSnapshot = {
  organizationId: string;
  organizationName: string;
  profileStatus: "in_progress" | "complete" | "enriched";
  profile: Omit<OrganizationProfileSubmission, "context">;
  geography: OrganizationGeographySummary;
  team: OrganizationTeamMember[];
  invitations: OrganizationInvitation[];
  verifications: OrganizationVerification[];
  service: "postgres";
};

export type OrganizationProfileValidationResult =
  | { ok: true; submission: OrganizationProfileSubmission; completion: OrganizationProfileCompletion }
  | { ok: false; errors: OrganizationProfileFieldErrors };

type SearchParamsLike = Record<string, string | string[] | undefined>;

export const ORGANIZATION_ROLE_OPTIONS: ReadonlyArray<{ id: OrganizationRole; label: string; description: string }> = [
  { id: "business", label: "Business", description: "Operate, sell, contract, or deliver services." },
  { id: "supplier", label: "Supplier", description: "Supply products, materials, or services." },
  { id: "buyer", label: "Buyer", description: "Source products, services, or partners." },
  { id: "issuer", label: "RFx issuer", description: "Publish solicitations or structured opportunities." },
  { id: "government", label: "Government", description: "Public-sector organization or agency." },
  { id: "economic_development", label: "Economic development", description: "Support business and place-based growth." },
  { id: "resource_provider", label: "Resource provider", description: "Provide capital, advising, facilities, or assistance." },
  { id: "business_organization", label: "Business organization", description: "Chamber, association, or ecosystem organization." },
  { id: "lender", label: "Lender", description: "Provide business lending or financial services." },
  { id: "education", label: "Education", description: "University, college, workforce, or training provider." },
  { id: "nonprofit", label: "Nonprofit", description: "Mission-driven organization participating in the Exchange." },
  { id: "other", label: "Other", description: "Another organization role not listed here." },
];

export const ORGANIZATION_GOAL_OPTIONS: ReadonlyArray<{ id: OrganizationGoal; label: string }> = [
  { id: "find_opportunities", label: "Find RFx and opportunities" },
  { id: "issue_opportunities", label: "Issue RFx and opportunities" },
  { id: "find_customers", label: "Find customers and buyers" },
  { id: "find_suppliers", label: "Find suppliers" },
  { id: "find_teammates", label: "Find teaming partners" },
  { id: "referrals", label: "Give and receive referrals" },
  { id: "find_resources", label: "Find resources and assistance" },
  { id: "explore_network", label: "Explore the local and regional network" },
];

const roleIds = new Set<OrganizationRole>(ORGANIZATION_ROLE_OPTIONS.map((option) => option.id));
const goalIds = new Set<OrganizationGoal>(ORGANIZATION_GOAL_OPTIONS.map((option) => option.id));
const claimModes = new Set<OrganizationClaimMode>(["claimed", "created", "selected"]);

function single(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanLong(value: unknown, maxLength = 1600) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeReturnTo(value: unknown) {
  const candidate = clean(value, 300);
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : undefined;
}

function validHttpUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeDomain(value: string) {
  return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeClaimMode(value: unknown): OrganizationClaimMode {
  const candidate = clean(value, 32) as OrganizationClaimMode;
  return claimModes.has(candidate) ? candidate : "selected";
}

function sanitizeContext(value: unknown): OrganizationProfileContext {
  if (!isRecord(value)) return { claimMode: "selected" };
  const organizationId = clean(value.organizationId, 120);
  const organizationName = clean(value.organizationName, 180);
  const geography = clean(value.geography, 180);
  const returnTo = safeReturnTo(value.returnTo);
  return {
    claimMode: sanitizeClaimMode(value.claimMode),
    ...(organizationId ? { organizationId } : {}),
    ...(organizationName ? { organizationName } : {}),
    ...(geography ? { geography } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}

function sanitizedArray<T extends string>(value: unknown, supported: Set<T>): T[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is T => typeof item === "string" && supported.has(item as T)))];
}

export function organizationProfileContextFromSearchParams(params: SearchParamsLike): OrganizationProfileContext {
  const organizationId = clean(single(params.organization));
  const organizationName = clean(single(params.name));
  const geography = clean(single(params.geography));
  const returnTo = safeReturnTo(single(params.returnTo));
  return {
    claimMode: sanitizeClaimMode(single(params.claim)),
    ...(organizationId ? { organizationId } : {}),
    ...(organizationName ? { organizationName } : {}),
    ...(geography ? { geography } : {}),
    ...(returnTo ? { returnTo } : {}),
  };
}

export function validateOrganizationProfilePayload(value: unknown, requireComplete = true): OrganizationProfileValidationResult {
  if (!isRecord(value)) return { ok: false, errors: { form: "Organization profile details are required." } };

  const context = sanitizeContext(value.context);
  const displayName = clean(value.displayName, 180);
  const legalName = clean(value.legalName, 180);
  const description = cleanLong(value.description, 1200);
  const website = clean(value.website, 300);
  const primaryDomain = normalizeDomain(clean(value.primaryDomain, 180));
  const industry = clean(value.industry, 180);
  const naics = clean(value.naics, 80);
  const roles = sanitizedArray(value.roles, roleIds);
  const contactName = clean(value.contactName, 180);
  const contactTitle = clean(value.contactTitle, 160);
  const contactEmail = clean(value.contactEmail, 254).toLowerCase();
  const contactPhone = clean(value.contactPhone, 60);
  const brandName = clean(value.brandName, 180);
  const logoUrl = clean(value.logoUrl, 500);
  const searchable = value.searchable !== false;
  const mapVisible = value.mapVisible !== false;
  const publicContact = value.publicContact === true;
  const goals = sanitizedArray(value.goals, goalIds);

  const completion: OrganizationProfileCompletion = {
    identity: Boolean(displayName && description.length >= 40),
    contact: Boolean(contactName && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)),
    role: roles.length > 0,
    visibility: typeof searchable === "boolean" && typeof mapVisible === "boolean" && typeof publicContact === "boolean",
    goals: goals.length > 0,
  };

  const errors: OrganizationProfileFieldErrors = {};
  if (!context.organizationId) errors.organization = "A resolved organization is required before the profile can be saved.";
  if (website && !validHttpUrl(website)) errors.website = "Enter a valid http or https website URL.";
  if (logoUrl && !validHttpUrl(logoUrl)) errors.logoUrl = "Enter a valid http or https logo URL.";
  if (primaryDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(primaryDomain)) errors.primaryDomain = "Enter a valid organization domain.";

  if (requireComplete) {
    if (!displayName) errors.displayName = "Enter the organization name used in RFxchange.";
    if (!description || description.length < 40) errors.description = "Describe the organization in at least 40 characters.";
    if (roles.length === 0) errors.roles = "Select at least one way the organization participates.";
    if (!contactName) errors.contactName = "Enter a primary organization contact.";
    if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = "Enter a valid business email address.";
    if (goals.length === 0) errors.goals = "Select at least one first-value goal.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    completion,
    submission: {
      context,
      displayName,
      legalName,
      description,
      website,
      primaryDomain,
      industry,
      naics,
      roles,
      contactName,
      contactTitle,
      contactEmail,
      contactPhone,
      brandName,
      logoUrl,
      searchable,
      mapVisible,
      publicContact,
      goals,
    },
  };
}

export function organizationProfileHandoffHref(organizationId: string, context: OrganizationProfileContext) {
  const params = new URLSearchParams({ organization: organizationId });
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return `/onboarding/capabilities?${params.toString()}`;
}
