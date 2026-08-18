export const ONBOARDING_DETAIL_SUBJECTS = [
  "account",
  "organization",
  "geography",
  "profile",
  "capabilities",
  "membership",
  "readiness",
] as const;

export type OnboardingDetailSubject = (typeof ONBOARDING_DETAIL_SUBJECTS)[number];
export type OnboardingDetailClassification = "required" | "recommended" | "optional" | "conditional";
export type OnboardingDetailSource = "Onboarding" | "Registration" | "Capabilities" | "Project";
export type OnboardingServiceMaturity = "connected-reference" | "workflow-only" | "production-pending";

export interface OnboardingServiceTarget {
  endpoint?: string;
  method?: "GET" | "POST";
  action?: string;
  owner: string;
  maturity: OnboardingServiceMaturity;
  purpose: string;
}

export interface OnboardingWorkflowTarget {
  href: string;
  label: string;
  preserveReturnTo?: boolean;
  service: OnboardingServiceTarget;
}

export interface OnboardingDetailNode {
  id: string;
  label: string;
  description: string;
  classification: OnboardingDetailClassification;
  sources: readonly OnboardingDetailSource[];
  workflow: OnboardingWorkflowTarget;
  children?: readonly OnboardingDetailNode[];
}

export interface OnboardingDetailDefinition {
  subject: OnboardingDetailSubject;
  label: string;
  description: string;
  step: number;
  totalSteps: number;
  classification: OnboardingDetailClassification;
  sources: readonly OnboardingDetailSource[];
  workflow: OnboardingWorkflowTarget;
  children: readonly OnboardingDetailNode[];
}

export interface OnboardingDetailBreadcrumb {
  label: string;
  href: string;
}

const svc = (
  owner: string,
  maturity: OnboardingServiceMaturity,
  purpose: string,
  endpoint?: string,
  method?: "GET" | "POST",
  action?: string,
): OnboardingServiceTarget => ({ owner, maturity, purpose, ...(endpoint ? { endpoint } : {}), ...(method ? { method } : {}), ...(action ? { action } : {}) });

const workflow = (
  href: string,
  label: string,
  service: OnboardingServiceTarget,
  preserveReturnTo = false,
): OnboardingWorkflowTarget => ({ href, label, service, preserveReturnTo });

const node = (
  id: string,
  label: string,
  description: string,
  classification: OnboardingDetailClassification,
  sources: readonly OnboardingDetailSource[],
  target: OnboardingWorkflowTarget,
  children?: readonly OnboardingDetailNode[],
): OnboardingDetailNode => ({ id, label, description, classification, sources, workflow: target, ...(children?.length ? { children } : {}) });

const registrationService = svc(
  "Registration",
  "connected-reference",
  "The normalized registration API exists, but its identity adapter remains stateless/reference until durable identity infrastructure is connected.",
  "/api/identity/register",
  "POST",
);
const verificationService = (action?: string) => svc(
  "Account Verification",
  "connected-reference",
  "The verification API exists and validates the account-access challenge contract; delivery/session infrastructure remains a production adapter boundary.",
  "/api/identity/account-verification",
  "POST",
  action,
);
const organizationSearchService = svc(
  "Organization Selection / Creation",
  "connected-reference",
  "Organization search/entity-resolution is exposed by API. Claim/join/create persistence and authority decisions remain reference workflow behavior today.",
  "/api/onboarding/organizations",
  "GET",
);
const organizationMutationPending = svc(
  "Organization Selection / Creation",
  "production-pending",
  "Claim/join/create currently resolves in the owning workflow but does not yet have a canonical server-side mutation repository. Detail Surface does not simulate one.",
);
const geographyService = svc(
  "Geography",
  "connected-reference",
  "The Geography API performs server-side draft validation/context construction. Geocoding, authoritative geography policy, and durable PostGIS writes remain production adapters.",
  "/api/onboarding/geography",
  "POST",
);
const profileService = svc(
  "Organization Profile",
  "connected-reference",
  "The Organization Profile API validates the canonical handoff contract. The current adapter is reference rather than durable profile persistence.",
  "/api/onboarding/organization-profile",
  "POST",
);
const capabilityService = svc(
  "Capability Enrichment",
  "workflow-only",
  "The merged Capability Enrichment workflow exists, but no canonical onboarding capability/AMACS/evidence server API is exposed yet. Detail Surface delegates instead of inventing one.",
);
const membershipCatalogService = svc(
  "Pricing / Membership",
  "connected-reference",
  "The governed plan catalog is available by API. Live Stripe checkout, capacity reservation, payment reconciliation, and entitlement persistence remain production work.",
  "/api/membership/catalog",
  "GET",
);
const stripePendingService = svc(
  "Pricing / Membership",
  "production-pending",
  "Stripe payment execution is intentionally not implemented in Detail Surface and remains disabled in the owning Membership workflow until authenticated organization billing is connected.",
);
const readinessService = svc(
  "Exchange-ready Completion",
  "connected-reference",
  "The readiness API evaluates the normalized readiness contract. Its current repository inputs are reference data rather than canonical account/organization persistence.",
  "/api/onboarding/readiness",
  "GET",
);
const activationService = svc(
  "Exchange-ready Completion",
  "connected-reference",
  "The activation endpoint re-evaluates readiness and returns the governed handoff contract; durable activation/events remain a production repository boundary.",
  "/api/onboarding/readiness/activate",
  "POST",
);

const registration = workflow("/register", "Open registration", registrationService, true);
const verify = (action?: string) => workflow("/onboarding/account-verification", "Open account verification", verificationService(action), true);
const organization = workflow("/onboarding/organization", "Open organization workflow", organizationSearchService);
const organizationMutation = (label: string) => workflow("/onboarding/organization", label, organizationMutationPending);
const geography = workflow("/onboarding/geography", "Open Geography workflow", geographyService);
const profile = workflow("/onboarding/organization-profile", "Open Organization Profile", profileService, true);
const capabilities = workflow("/onboarding/capabilities", "Open Capability Enrichment", capabilityService);
const membership = workflow("/onboarding/membership", "Open Membership workflow", membershipCatalogService, true);
const completion = workflow("/onboarding/completion", "Open Exchange-ready review", readinessService, true);
const activate = workflow("/onboarding/completion", "Activate Exchange handoff", activationService, true);
const exchange = workflow("/exchange", "Enter the Exchange", svc("Authenticated Exchange", "workflow-only", "The existing authenticated Exchange shell is the post-onboarding destination."));

const definitions: Record<OnboardingDetailSubject, OnboardingDetailDefinition> = {
  account: {
    subject: "account",
    label: "Account & Identity",
    description: "Create the person-level account, preserve source-defined entry context, and prove control of the selected access method before organization onboarding.",
    step: 1,
    totalSteps: 6,
    classification: "required",
    sources: ["Onboarding", "Registration"],
    workflow: verify(),
    children: [
      node("account-creation", "Account Creation", "Establish the person-level RFxchange account.", "required", ["Onboarding", "Registration"], registration, [
        node("name", "Name", "Enter the participant name.", "required", ["Onboarding", "Registration"], registration),
        node("email-auth-method", "Email / Password or Auth Method", "Establish email and the supported authentication method.", "required", ["Onboarding"], registration),
      ]),
      node("verify-email-access", "Verify Email / Access", "Complete the account-access verification loop before organization setup.", "required", ["Onboarding", "Registration"], verify(), [
        node("send-verification", "Send Verification", "Issue the account verification challenge.", "required", ["Registration"], verify("request")),
        node("verification-link", "Verification Link", "Validate the verification challenge and continue only after success.", "required", ["Registration"], verify("verify")),
        node("resend-verification", "Resend Verification", "Resend an unavailable or expired verification challenge.", "conditional", ["Registration"], verify("resend")),
        node("change-email", "Change Email Address", "Correct the email address and issue a new challenge.", "conditional", ["Registration"], verify("change_email")),
      ]),
      node("alternate-entry-context", "Alternate Entry Context", "Preserve the Registration source's referral, partner-invite, and event/QR entry context through Identity without promoting it to authorization truth.", "conditional", ["Registration"], registration, [
        node("referral-link", "Referral Link", "Preserve sponsor/campaign referral context through registration and onboarding.", "conditional", ["Registration"], registration),
        node("partner-invite", "Partner Invite", "Preserve organization invitation context for later validation and membership resolution.", "conditional", ["Registration"], registration),
        node("qr-event-registration", "QR Code / Event Registration", "Preserve campaign/event acquisition context through Identity and onboarding.", "conditional", ["Registration"], registration),
      ]),
    ],
  },
  organization: {
    subject: "organization",
    label: "Organization",
    description: "Resolve one canonical organization identity, establish affiliation, and handle invitation/authority paths without creating duplicates.",
    step: 2,
    totalSteps: 6,
    classification: "required",
    sources: ["Onboarding", "Registration"],
    workflow: organization,
    children: [
      node("basic-user-onboarding", "Basic User Onboarding", "Choose the participant role and organization affiliation path.", "required", ["Onboarding"], organization, [
        node("welcome-role-selection", "Welcome / Role Selection", "Select the participant's organization role/participation context.", "required", ["Onboarding"], profile),
        node("organization-affiliation-choice", "Organization Affiliation Choice", "Choose whether to join an existing organization or create a new one.", "required", ["Onboarding"], organization, [
          node("join-existing-organization", "Join Existing Organization", "Find an existing canonical organization and request or accept membership.", "conditional", ["Onboarding"], organizationMutation("Join existing organization")),
          node("create-new-organization", "Create New Organization", "Create only when entity resolution does not identify the correct organization.", "conditional", ["Onboarding"], organizationMutation("Create new organization")),
        ]),
      ]),
      node("organization-setup", "Organization Setup", "Follow the Registration source's claim-or-create decision.", "required", ["Registration"], organization, [
        node("claim-existing-organization", "Claim Existing Organization", "Resolve to the existing record and enter the claim/authority path.", "conditional", ["Registration"], organizationMutation("Claim existing organization")),
        node("create-new-organization", "Create New Organization", "Create a canonical organization when no correct match exists.", "conditional", ["Registration"], organizationMutation("Create new organization")),
      ]),
      node("organization-setup-details", "Organization Setup Details", "Establish the source-defined identity, type, geography handoff, and visibility preferences.", "required", ["Onboarding"], profile, [
        node("organization-name", "Organization Name", "Confirm the organization name used by the canonical profile.", "required", ["Onboarding"], profile),
        node("organization-type", "Organization Type", "Confirm the organization type/participation classification.", "required", ["Onboarding"], profile),
        node("location-geography", "Location / Geography", "Continue to the governed Geography workflow rather than creating a duplicate location model.", "required", ["Onboarding"], geography),
        node("visibility-preferences", "Visibility Preferences", "Set organization search/map/contact visibility in the canonical profile workflow.", "required", ["Onboarding"], profile),
      ]),
      node("organization-details", "Organization Details", "Complete the Registration source's organization detail fields.", "required", ["Registration"], profile, [
        node("name-description", "Organization Name & Description", "Complete the Exchange-facing organization identity and description.", "required", ["Registration"], profile),
        node("industry-naics", "Industry / NAICS (optional)", "Add optional industry and NAICS context.", "optional", ["Registration"], profile),
        node("website-contact", "Website / Contact Info", "Add website and organization contact information.", "required", ["Registration"], profile),
      ]),
      node("referral-invitation", "Referral / Invitation", "Handle participants entering from an invitation or organization-admin referral path.", "conditional", ["Onboarding", "Registration"], organizationMutation("Open invitation / affiliation workflow"), [
        node("validate-invitation", "Validate Invitation", "Validate invitation context before it affects organization membership.", "required", ["Onboarding"], organizationMutation("Validate invitation")),
        node("accept-join-organization", "Accept and Join Organization", "Accept the invitation and establish organization membership.", "required", ["Onboarding"], organizationMutation("Accept and join organization")),
        node("set-role-confirm-access", "Set Role and Confirm Access", "Confirm role/access without equating authority with public organization verification.", "required", ["Onboarding"], organizationMutation("Set role and confirm access")),
      ]),
    ],
  },
  geography: {
    subject: "geography",
    label: "Geography & Location",
    description: "Keep primary geography, physical location, map placement, public precision, and service geography as separate spatial concepts.",
    step: 3,
    totalSteps: 6,
    classification: "required",
    sources: ["Registration", "Project"],
    workflow: geography,
    children: [
      node("select-geography", "Select Geography", "Choose the county, city, or region that establishes the initial market context.", "required", ["Registration"], geography, [
        node("search-county-city-region", "Search County / City / Region", "Search the governed geography list.", "required", ["Registration"], geography),
        node("primary-locality", "Primary Locality", "Confirm the locality used for onboarding and Exchange context.", "required", ["Registration", "Project"], geography),
        node("market-boundaries", "Market Boundaries", "Use the selected geography to establish the released market context.", "required", ["Registration"], geography),
      ]),
      node("location-map-placement", "Location / Map Placement", "Capture the physical address and confirm map placement.", "required", ["Registration", "Project"], geography, [
        node("physical-address", "Add Physical Address", "Enter the organization's base physical address.", "required", ["Registration"], geography),
        node("geocode-address", "Geocode Address", "Resolve the address through the Geography provider boundary.", "required", ["Registration"], geography),
        node("confirm-marker", "Confirm Marker Placement", "Confirm the resulting location before Geography completion.", "required", ["Registration"], geography),
      ]),
      node("visibility-preferences", "Visibility Preferences", "Control public precision independently of the stored physical address.", "required", ["Onboarding", "Project"], geography, [
        node("exact", "Exact", "Permit exact public location where appropriate.", "conditional", ["Project"], geography),
        node("approximate", "Approximate", "Expose an approximate public location.", "conditional", ["Project"], geography),
        node("locality-only", "Locality Only", "Expose only the locality for the public presence.", "conditional", ["Project"], geography),
      ]),
      node("service-geography", "Service Geography", "Describe where the organization can perform work separately from where it is based.", "required", ["Project"], geography),
      node("review", "Review Geography", "Review the normalized geography context before continuing.", "required", ["Project"], geography),
    ],
  },
  profile: {
    subject: "profile",
    label: "Organization Profile",
    description: "Build the canonical Exchange-facing organization profile reused across authenticated lenses and cross-lens workflows.",
    step: 4,
    totalSteps: 6,
    classification: "required",
    sources: ["Onboarding", "Project"],
    workflow: profile,
    children: [
      node("core-profile-details", "Core Profile Details", "Complete organization overview, contacts, description, and key information.", "required", ["Onboarding"], profile, [
        node("organization-overview", "Organization Overview", "Describe the organization for Exchange participants.", "required", ["Onboarding"], profile),
        node("contacts", "Contacts", "Maintain the primary organization contact separately from the signed-in user's identity.", "required", ["Onboarding"], profile),
        node("description", "Description", "Complete the source-defined organization description.", "required", ["Onboarding"], profile),
        node("key-info", "Key Info", "Complete the remaining source-defined key organization information.", "required", ["Onboarding"], profile),
      ]),
      node("industry-services", "Industry & Services", "Capture industry context and service offerings used by capability enrichment.", "recommended", ["Onboarding"], profile, [
        node("industries-served", "Industries Served", "Identify industries served by the organization.", "recommended", ["Onboarding"], profile),
        node("service-offerings", "Service Offerings", "Describe service offerings that seed capability enrichment.", "recommended", ["Onboarding"], profile),
      ]),
      node("roles-goals-visibility", "Role, Goals & Visibility", "Set participation role, first-value goals, and discoverability preferences.", "required", ["Onboarding", "Project"], profile, [
        node("welcome-role-selection", "Welcome / Role Selection", "Select how the organization participates in RFxchange.", "required", ["Onboarding"], profile),
        node("visibility-preferences", "Visibility Preferences", "Control organization search, map, and contact visibility.", "required", ["Onboarding", "Project"], profile),
        node("goals", "Goals", "Capture the intended first-value path for post-onboarding routing.", "required", ["Project"], profile),
      ]),
    ],
  },
  capabilities: {
    subject: "capabilities",
    label: "Capability Enrichment",
    description: "Progress from plain-language capabilities through AMACS assistance, evidence, and discoverability without treating optional enrichment as an access gate.",
    step: 5,
    totalSteps: 6,
    classification: "required",
    sources: ["Onboarding", "Capabilities"],
    workflow: capabilities,
    children: [
      node("core-profile-details", "Core Profile Details", "Review organization overview, contacts, description, and key information used to seed enrichment.", "required", ["Onboarding"], profile, [
        node("organization-overview", "Organization Overview", "Review the organization overview used to seed enrichment.", "required", ["Onboarding"], profile),
        node("contacts", "Contacts", "Review the source-defined organization contacts.", "required", ["Onboarding"], profile),
        node("description", "Description", "Review the organization description.", "required", ["Onboarding"], profile),
        node("key-info", "Key Info", "Review key organization information used by enrichment.", "required", ["Onboarding"], profile),
      ]),
      node("industry-services", "Industry & Services", "Review industries served and service offerings.", "recommended", ["Onboarding"], profile, [
        node("industries-served", "Industries Served", "Review industries served by the organization.", "recommended", ["Onboarding"], profile),
        node("service-offerings", "Service Offerings", "Review service offerings before detailed capability entry.", "recommended", ["Onboarding"], profile),
      ]),
      node("capabilities-entry", "Capabilities Entry", "Add detailed capabilities and solutions in plain language.", "required", ["Onboarding"], capabilities, [
        node("detailed-capabilities", "Detailed Capabilities", "Describe what the organization can actually do.", "required", ["Onboarding"], capabilities),
        node("solutions", "Solutions", "Add the solutions represented by capability claims.", "recommended", ["Onboarding"], capabilities),
      ]),
      node("amacs-mapping", "AMACS Mapping / AI-to-AMACS Assistance", "Use assistance to propose structured AMACS alignment while preserving organization confirmation as a separate truth state.", "recommended", ["Onboarding", "Capabilities"], capabilities, [
        node("suggested-mapping", "Suggested Mapping", "Review the AMACS mapping suggested for the organization capability.", "recommended", ["Project", "Capabilities"], capabilities),
        node("user-confirmed-mapping", "User-confirmed Mapping", "Confirm the organization-asserted AMACS mapping separately from automated inference.", "recommended", ["Project", "Capabilities"], capabilities),
        node("alternative-mappings", "Alternative Mappings", "Review alternative AMACS mappings where the source/context supports them.", "optional", ["Project"], capabilities),
        node("mapping-confidence", "Mapping Confidence / Explanation", "Show mapping confidence or explanatory context without presenting it as verification.", "optional", ["Project"], capabilities),
      ]),
      node("evidence-certifications", "Evidence / Certifications", "Support capability claims without treating an upload as independent verification.", "recommended", ["Onboarding", "Capabilities"], capabilities, [
        node("certifications", "Certifications", "Associate relevant certifications with capability claims.", "recommended", ["Onboarding"], capabilities),
        node("licenses", "Licenses", "Associate supporting licenses.", "recommended", ["Onboarding"], capabilities),
        node("case-studies", "Case Studies", "Associate case studies with applicable capabilities.", "optional", ["Onboarding"], capabilities),
        node("supporting-documents", "Supporting Documents", "Attach supporting documents when the evidence/object-storage service is connected.", "optional", ["Onboarding"], capabilities),
      ]),
      node("tags-keywords-specialties", "Tags / Keywords / Specialties", "Add discoverability terms without changing canonical AMACS taxonomy truth.", "optional", ["Onboarding"], capabilities, [
        node("keywords", "Keywords", "Add alternate search terminology.", "optional", ["Onboarding"], capabilities),
        node("specialties", "Specialties", "Add organization specialties that improve discovery.", "optional", ["Onboarding"], capabilities),
        node("tags", "Tags", "Add controlled discoverability tags where supported.", "optional", ["Onboarding"], capabilities),
      ]),
    ],
  },
  membership: {
    subject: "membership",
    label: "Membership",
    description: "Resolve free or paid participation without allowing payment to purchase authority, verification, or credibility.",
    step: 5,
    totalSteps: 6,
    classification: "conditional",
    sources: ["Registration", "Project"],
    workflow: membership,
    children: [
      node("membership-selection", "Membership Selection", "Choose the organization's participation path.", "conditional", ["Registration", "Project"], membership, [
        node("founding-membership", "Founding Membership ($49/mo)", "Select the Founding Membership offer when available.", "optional", ["Registration", "Project"], workflow("/onboarding/membership?membership=founding", "Review Founding Membership", membershipCatalogService, true)),
        node("future-plans", "Future Plans as Available", "Review future plans only when the governed Membership catalog exposes them.", "optional", ["Registration"], membership),
        node("continue-free", "Continue Free", "Continue through core readiness without making paid membership a universal access gate.", "optional", ["Project"], membership),
      ]),
      node("payment", "Payment (Stripe)", "Complete payment only for a selected paid plan through the Membership-owned Stripe boundary.", "conditional", ["Registration"], workflow("/onboarding/membership?membership=founding", "Open Membership payment handoff", stripePendingService, true), [
        node("enter-payment-details", "Enter Payment Details", "Collect payment details in Stripe-owned secure checkout, not Detail Surface.", "conditional", ["Registration"], workflow("/onboarding/membership?membership=founding", "Open secure payment handoff", stripePendingService, true)),
        node("secure-checkout", "Secure Checkout", "Use Stripe checkout when the Membership integration is operational.", "conditional", ["Registration"], workflow("/onboarding/membership?membership=founding", "Open secure checkout handoff", stripePendingService, true)),
        node("payment-confirmation", "Payment Confirmation", "Return confirmed payment/entitlement state to onboarding before readiness evaluation.", "conditional", ["Registration"], workflow("/onboarding/membership?membership=founding", "Review payment state", stripePendingService, true)),
      ]),
    ],
  },
  readiness: {
    subject: "readiness",
    label: "Exchange-ready Completion",
    description: "Evaluate blocking readiness, resolve missing items, then activate the handoff to the existing authenticated Exchange shell.",
    step: 6,
    totalSteps: 6,
    classification: "required",
    sources: ["Onboarding", "Registration"],
    workflow: completion,
    children: [
      node("review-completion-checkpoint", "Review & Completion Checkpoint", "Review required/recommended completeness and route missing items back to their owning workflow.", "required", ["Onboarding"], completion, [
        node("completeness-check", "Completeness Check", "Evaluate required and recommended onboarding items through the Readiness service.", "required", ["Onboarding"], completion),
        node("missing-items", "Missing Items / Actionable Prompts", "Surface blocking or recommended items as concrete links back to the owning workflow.", "required", ["Onboarding"], completion),
        node("save-continue-later", "Save and Continue Later", "Use owning domain persistence; Detail Surface does not keep a browser-only shadow record.", "recommended", ["Onboarding"], completion),
        node("profile-completeness-indicator", "Profile Completeness Indicator", "Use completeness as guidance without turning optional enrichment into a blocking access gate.", "recommended", ["Onboarding"], completion),
      ]),
      node("exchange-ready", "Exchange Ready", "Activate organization presence and enter the existing Exchange after all blocking gates pass.", "required", ["Onboarding", "Registration"], activate, [
        node("listed-presence", "Listed / Presence in Exchange", "Activate the permitted marker or off-map organization presence.", "required", ["Onboarding"], activate),
        node("browse-exchange", "Browse RFx, Resources, Intelligence, and Capabilities", "Enter the existing authenticated Exchange rather than an onboarding-only home.", "required", ["Onboarding"], exchange),
        node("profile-through-menu", "Profile Available Through Menu", "Manage the same canonical organization profile through the authenticated Menu after entry.", "recommended", ["Onboarding"], exchange),
      ]),
    ],
  },
};

const legacyRedirects: Record<string, string> = {
  authority: "/onboarding/detail/organization/referral-invitation/set-role-confirm-access",
  capability: "/onboarding/detail/capabilities/capabilities-entry",
  evidence: "/onboarding/detail/capabilities/evidence-certifications",
  "role-goals": "/onboarding/detail/profile/roles-goals-visibility",
};

export function isOnboardingDetailSubject(value: string): value is OnboardingDetailSubject {
  return (ONBOARDING_DETAIL_SUBJECTS as readonly string[]).includes(value);
}

export function getLegacyOnboardingDetailRedirect(subject: string): string | undefined {
  return legacyRedirects[subject];
}

export function listOnboardingDetailDefinitions(): readonly OnboardingDetailDefinition[] {
  return ONBOARDING_DETAIL_SUBJECTS.map((subject) => definitions[subject]);
}

export function getOnboardingDetailDefinition(subject: string): OnboardingDetailDefinition | null {
  return isOnboardingDetailSubject(subject) ? definitions[subject] : null;
}

export function onboardingDetailHref(subject: OnboardingDetailSubject, path: readonly string[] = []): string {
  return `/onboarding/detail/${subject}${path.length ? `/${path.map(encodeURIComponent).join("/")}` : ""}`;
}

export function getOnboardingDetailNode(subject: OnboardingDetailSubject, path: readonly string[]): OnboardingDetailDefinition | OnboardingDetailNode | null {
  const definition = definitions[subject];
  if (path.length === 0) return definition;
  let children: readonly OnboardingDetailNode[] = definition.children;
  let current: OnboardingDetailNode | undefined;
  for (const segment of path) {
    current = children.find((candidate) => candidate.id === segment);
    if (!current) return null;
    children = current.children ?? [];
  }
  return current ?? null;
}

export function getOnboardingDetailBreadcrumbs(subject: OnboardingDetailSubject, path: readonly string[]): readonly OnboardingDetailBreadcrumb[] {
  const definition = definitions[subject];
  const crumbs: OnboardingDetailBreadcrumb[] = [{ label: definition.label, href: onboardingDetailHref(subject) }];
  let children: readonly OnboardingDetailNode[] = definition.children;
  const accumulated: string[] = [];
  for (const segment of path) {
    const current = children.find((candidate) => candidate.id === segment);
    if (!current) break;
    accumulated.push(segment);
    crumbs.push({ label: current.label, href: onboardingDetailHref(subject, accumulated) });
    children = current.children ?? [];
  }
  return crumbs;
}

export function getOnboardingDetailParentHref(subject: OnboardingDetailSubject, path: readonly string[]): string {
  return path.length === 0 ? "/onboarding/detail" : onboardingDetailHref(subject, path.slice(0, -1));
}

export interface OnboardingStaticDetailPath { subject: OnboardingDetailSubject; path: string[]; }
export function listOnboardingStaticDetailPaths(): OnboardingStaticDetailPath[] {
  const paths: OnboardingStaticDetailPath[] = [];
  const walk = (subject: OnboardingDetailSubject, nodes: readonly OnboardingDetailNode[], prefix: string[] = []) => {
    for (const child of nodes) {
      const path = [...prefix, child.id];
      paths.push({ subject, path });
      if (child.children?.length) walk(subject, child.children, path);
    }
  };
  for (const definition of listOnboardingDetailDefinitions()) walk(definition.subject, definition.children);
  return paths;
}

export function sanitizeInternalDetailHref(value: string | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://rfxchange.local");
    if (parsed.origin !== "https://rfxchange.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
