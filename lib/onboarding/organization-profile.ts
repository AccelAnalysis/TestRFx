export type OrganizationClaimMode = "claimed" | "created" | "selected";
export type LocationVisibility = "exact" | "approximate" | "locality";

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
  industry: string;
  naics: string;
  roles: OrganizationRole[];
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  serviceGeographies: string;
  locationVisibility: LocationVisibility;
  searchable: boolean;
  mapVisible: boolean;
  publicContact: boolean;
  goals: OrganizationGoal[];
  capabilitySeed: string;
};

export type OrganizationProfileField =
  | "displayName"
  | "description"
  | "roles"
  | "contactName"
  | "contactEmail"
  | "addressLine1"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "serviceGeographies"
  | "goals"
  | "capabilitySeed"
  | "form";

export type OrganizationProfileFieldErrors = Partial<Record<OrganizationProfileField, string>>;

export type OrganizationProfileAccepted = {
  status: "profile_complete";
  organizationId: string;
  organizationName: string;
  nextStep: "capability_enrichment";
  handoffHref: string;
  completion: {
    identity: true;
    contact: true;
    location: true;
    serviceGeography: true;
    role: true;
    visibility: true;
    capabilitySeed: true;
  };
  context: OrganizationProfileContext;
};

export type OrganizationProfileValidationResult =
  | { ok: true; submission: OrganizationProfileSubmission }
  | { ok: false; errors: OrganizationProfileFieldErrors };

type SearchParamsLike = Record<string, string | string[] | undefined>;

export const ORGANIZATION_ROLE_OPTIONS: ReadonlyArray<{
  id: OrganizationRole;
  label: string;
  description: string;
}> = [
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

export const ORGANIZATION_GOAL_OPTIONS: ReadonlyArray<{
  id: OrganizationGoal;
  label: string;
}> = [
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
const visibilityModes = new Set<LocationVisibility>(["exact", "approximate", "locality"]);

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

export function validateOrganizationProfilePayload(value: unknown): OrganizationProfileValidationResult {
  if (!isRecord(value)) return { ok: false, errors: { form: "Organization profile details are required." } };

  const context = sanitizeContext(value.context);
  const displayName = clean(value.displayName, 180);
  const legalName = clean(value.legalName, 180);
  const description = cleanLong(value.description, 1200);
  const website = clean(value.website, 300);
  const industry = clean(value.industry, 180);
  const naics = clean(value.naics, 80);
  const roles = sanitizedArray(value.roles, roleIds);
  const contactName = clean(value.contactName, 180);
  const contactTitle = clean(value.contactTitle, 160);
  const contactEmail = clean(value.contactEmail, 254).toLowerCase();
  const contactPhone = clean(value.contactPhone, 60);
  const addressLine1 = clean(value.addressLine1, 220);
  const addressLine2 = clean(value.addressLine2, 220);
  const city = clean(value.city, 120);
  const region = clean(value.region, 120);
  const postalCode = clean(value.postalCode, 32);
  const country = clean(value.country, 80);
  const serviceGeographies = cleanLong(value.serviceGeographies, 800);
  const locationVisibilityCandidate = clean(value.locationVisibility, 32) as LocationVisibility;
  const locationVisibility = visibilityModes.has(locationVisibilityCandidate) ? locationVisibilityCandidate : "locality";
  const searchable = value.searchable !== false;
  const mapVisible = value.mapVisible !== false;
  const publicContact = value.publicContact === true;
  const goals = sanitizedArray(value.goals, goalIds);
  const capabilitySeed = cleanLong(value.capabilitySeed, 1200);
  const errors: OrganizationProfileFieldErrors = {};

  if (!displayName) errors.displayName = "Enter the organization name used in RFxchange.";
  if (!description || description.length < 40) errors.description = "Describe the organization in at least 40 characters.";
  if (roles.length === 0) errors.roles = "Select at least one way the organization participates.";
  if (!contactName) errors.contactName = "Enter a primary organization contact.";
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = "Enter a valid business email address.";
  if (!addressLine1) errors.addressLine1 = "Enter the primary operating address.";
  if (!city) errors.city = "Enter a city or locality.";
  if (!region) errors.region = "Enter a state or region.";
  if (!postalCode) errors.postalCode = "Enter a postal code.";
  if (!country) errors.country = "Enter a country.";
  if (!serviceGeographies) errors.serviceGeographies = "Describe where the organization can provide service.";
  if (goals.length === 0) errors.goals = "Select at least one goal so RFxchange can configure the first-value pathway.";
  if (!capabilitySeed || capabilitySeed.length < 10) errors.capabilitySeed = "Add at least one plain-language capability before enrichment.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    submission: {
      context,
      displayName,
      legalName,
      description,
      website,
      industry,
      naics,
      roles,
      contactName,
      contactTitle,
      contactEmail,
      contactPhone,
      addressLine1,
      addressLine2,
      city,
      region,
      postalCode,
      country,
      serviceGeographies,
      locationVisibility,
      searchable,
      mapVisible,
      publicContact,
      goals,
      capabilitySeed,
    },
  };
}

export function organizationProfileHandoffHref(organizationId: string, context: OrganizationProfileContext) {
  const params = new URLSearchParams({ organization: organizationId });
  if (context.returnTo) params.set("returnTo", context.returnTo);
  return `/onboarding/capabilities?${params.toString()}`;
}