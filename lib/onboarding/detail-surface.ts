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
export type OnboardingServiceMethod = "GET" | "POST";

export interface OnboardingServiceTarget {
  endpoint: string;
  method: OnboardingServiceMethod;
  action?: string;
  owner: string;
  purpose: string;
}

export interface OnboardingWorkflowTarget {
  href: string;
  label: string;
  service?: OnboardingServiceTarget;
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
  workflow: OnboardingWorkflowTarget;
  children: readonly OnboardingDetailNode[];
}

export interface OnboardingDetailBreadcrumb {
  label: string;
  href: string;
}

const accountVerificationService: OnboardingServiceTarget = {
  endpoint: "/api/identity/account-verification",
  method: "POST",
  owner: "Identity / Account Verification",
  purpose: "Request, resend, change email, and verify account-access challenges.",
};

const organizationSearchService: OnboardingServiceTarget = {
  endpoint: "/api/onboarding/organizations",
  method: "GET",
  owner: "Organization Selection / Creation",
  purpose: "Search and resolve candidate organizations before claim, join, or creation.",
};

const geographyService: OnboardingServiceTarget = {
  endpoint: "/api/onboarding/geography",
  method: "POST",
  owner: "Geography",
  purpose: "Validate the canonical geography draft and construct downstream geography context.",
};

const organizationProfileService: OnboardingServiceTarget = {
  endpoint: "/api/onboarding/organization-profile",
  method: "POST",
  owner: "Organization Profile",
  purpose: "Validate and accept the Exchange-facing organization profile handoff.",
};

const membershipCatalogService: OnboardingServiceTarget = {
  endpoint: "/api/membership/catalog",
  method: "GET",
  owner: "Pricing / Membership",
  purpose: "Return the governed membership catalog; checkout remains owned by Membership.",
};

const readinessService: OnboardingServiceTarget = {
  endpoint: "/api/onboarding/readiness",
  method: "GET",
  owner: "Exchange-ready Completion",
  purpose: "Evaluate the normalized readiness snapshot and blocking items.",
};

const activationService: OnboardingServiceTarget = {
  endpoint: "/api/onboarding/readiness/activate",
  method: "POST",
  owner: "Exchange-ready Completion",
  purpose: "Re-evaluate blocking readiness and activate the controlled Exchange handoff.",
};

const registrationWorkflow: OnboardingWorkflowTarget = { href: "/register", label: "Open registration" };
const accountVerificationWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/account-verification",
  label: "Open account verification",
  service: accountVerificationService,
};
const organizationWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/organization",
  label: "Open organization resolution",
  service: organizationSearchService,
};
const geographyWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/geography",
  label: "Open Geography workflow",
  service: geographyService,
};
const profileWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/organization-profile",
  label: "Open Organization Profile",
  service: organizationProfileService,
};
const capabilitiesWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/capabilities",
  label: "Open Capability Enrichment",
};
const membershipWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/membership",
  label: "Open Membership workflow",
  service: membershipCatalogService,
};
const completionWorkflow: OnboardingWorkflowTarget = {
  href: "/onboarding/completion",
  label: "Open Exchange-ready review",
  service: readinessService,
};

const definitions: Record<OnboardingDetailSubject, OnboardingDetailDefinition> = {
  account: {
    subject: "account",
    label: "Account & Identity",
    description: "Establish the person-level account and prove control of the selected access method before organization onboarding.",
    step: 1,
    totalSteps: 6,
    classification: "required",
    workflow: accountVerificationWorkflow,
    children: [
      {
        id: "account-creation",
        label: "Account Creation",
        description: "Create the user account without conflating person identity with organization authority.",
        classification: "required",
        sources: ["Onboarding", "Registration"],
        workflow: registrationWorkflow,
        children: [
          { id: "name", label: "Name", description: "Enter the user's name.", classification: "required", sources: ["Onboarding", "Registration"], workflow: registrationWorkflow },
          { id: "email-auth-method", label: "Email / Password or Auth Method", description: "Establish the email and supported authentication method used by the Identity service.", classification: "required", sources: ["Onboarding"], workflow: registrationWorkflow },
        ],
      },
      {
        id: "verify-email-access",
        label: "Verify Email / Access",
        description: "Complete the account-access verification loop before organization setup.",
        classification: "required",
        sources: ["Onboarding", "Registration"],
        workflow: accountVerificationWorkflow,
        children: [
          { id: "request-verification", label: "Send Verification", description: "Request the verification challenge from the Account Verification service.", classification: "required", sources: ["Registration"], workflow: { ...accountVerificationWorkflow, service: { ...accountVerificationService, action: "request" } } },
          { id: "verification-link", label: "Verification Link", description: "Validate the verification challenge and continue only after a successful result.", classification: "required", sources: ["Registration"], workflow: { ...accountVerificationWorkflow, service: { ...accountVerificationService, action: "verify" } } },
          { id: "resend-verification", label: "Resend Verification", description: "Resend the verification challenge when the original message is unavailable or expired.", classification: "conditional", sources: ["Registration"], workflow: { ...accountVerificationWorkflow, service: { ...accountVerificationService, action: "resend" } } },
          { id: "change-email", label: "Change Email Address", description: "Correct the account email and issue a new verification challenge.", classification: "conditional", sources: ["Registration"], workflow: { ...accountVerificationWorkflow, service: { ...accountVerificationService, action: "change_email" } } },
        ],
      },
    ],
  },
  organization: {
    subject: "organization",
    label: "Organization",
    description: "Resolve one canonical organization identity, establish affiliation, and handle invitation/authority paths without creating duplicates.",
    step: 2,
    totalSteps: 6,
    classification: "required",
    workflow: organizationWorkflow,
    children: [
      {
        id: "basic-user-onboarding",
        label: "Basic User Onboarding",
        description: "Capture the role/affiliation choice that determines the organization path.",
        classification: "required",
        sources: ["Onboarding"],
        workflow: organizationWorkflow,
        children: [
          { id: "welcome-role-selection", label: "Welcome / Role Selection", description: "Select the user's participation context before organization affiliation.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "join-existing-organization", label: "Join Existing Organization", description: "Search for and request or accept membership in an existing canonical organization.", classification: "conditional", sources: ["Onboarding"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=join" } },
          { id: "create-new-organization", label: "Create New Organization", description: "Create an organization only after existing-organization resolution does not identify the correct entity.", classification: "conditional", sources: ["Onboarding"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=create" } },
        ],
      },
      {
        id: "organization-resolution",
        label: "Organization Setup",
        description: "Claim an existing organization or create a new canonical organization record.",
        classification: "required",
        sources: ["Registration"],
        workflow: organizationWorkflow,
        children: [
          { id: "claim-existing-organization", label: "Claim Existing Organization", description: "Resolve the entered organization to an existing record and enter the claim/authority path.", classification: "conditional", sources: ["Registration"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=claim" } },
          { id: "create-new-organization", label: "Create New Organization", description: "Create the organization when no canonical match represents the participant.", classification: "conditional", sources: ["Registration"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=create" } },
        ],
      },
      {
        id: "organization-setup",
        label: "Organization Setup Details",
        description: "Establish the basic organization identity and initial visibility context.",
        classification: "required",
        sources: ["Onboarding"],
        workflow: profileWorkflow,
        children: [
          { id: "organization-name", label: "Organization Name", description: "Confirm the organization name used by the canonical profile.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "organization-type", label: "Organization Type", description: "Confirm the organization type/participation classification.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "location-geography", label: "Location / Geography", description: "Continue to the governed Geography workflow rather than storing a second location copy here.", classification: "required", sources: ["Onboarding"], workflow: geographyWorkflow },
          { id: "visibility-preferences", label: "Visibility Preferences", description: "Set how the organization should be exposed in Exchange discovery and map contexts.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
        ],
      },
      {
        id: "organization-details",
        label: "Organization Details",
        description: "Complete the organization details shown in the Registration source flow.",
        classification: "required",
        sources: ["Registration"],
        workflow: profileWorkflow,
        children: [
          { id: "name-description", label: "Organization Name & Description", description: "Complete the Exchange-facing name and description.", classification: "required", sources: ["Registration"], workflow: profileWorkflow },
          { id: "industry-naics", label: "Industry / NAICS (optional)", description: "Add industry and NAICS context without making it an artificial access gate.", classification: "optional", sources: ["Registration"], workflow: profileWorkflow },
          { id: "website-contact", label: "Website / Contact Info", description: "Add organization website and contact information in the canonical Organization Profile workflow.", classification: "required", sources: ["Registration"], workflow: profileWorkflow },
        ],
      },
      {
        id: "referral-invitation",
        label: "Referral / Invitation",
        description: "Handle participants who entered through an invite link or were invited by an organization administrator.",
        classification: "conditional",
        sources: ["Onboarding", "Registration"],
        workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=join" },
        children: [
          { id: "validate-invitation", label: "Validate Invitation", description: "Validate invitation context before it influences organization membership.", classification: "required", sources: ["Onboarding"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=join" } },
          { id: "accept-join-organization", label: "Accept and Join Organization", description: "Accept the invitation and establish the organization membership relationship.", classification: "required", sources: ["Onboarding"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=join" } },
          { id: "set-role-confirm-access", label: "Set Role and Confirm Access", description: "Confirm the member role and organization access without equating it to public organization verification.", classification: "required", sources: ["Onboarding"], workflow: { ...organizationWorkflow, href: "/onboarding/organization?mode=join" } },
        ],
      },
    ],
  },
  geography: {
    subject: "geography",
    label: "Geography & Location",
    description: "Establish primary geography, physical location, map placement, visibility, and service geography as separate spatial concepts.",
    step: 3,
    totalSteps: 6,
    classification: "required",
    workflow: geographyWorkflow,
    children: [
      {
        id: "select-geography",
        label: "Select Geography",
        description: "Choose the county, city, or region that establishes the initial RFxchange market context.",
        classification: "required",
        sources: ["Registration"],
        workflow: geographyWorkflow,
        children: [
          { id: "search-county-city-region", label: "Search County / City / Region", description: "Search the governed geography list for the participant's primary locality.", classification: "required", sources: ["Registration"], workflow: geographyWorkflow },
          { id: "primary-locality", label: "Primary Locality", description: "Confirm the locality used for onboarding and Exchange context.", classification: "required", sources: ["Registration", "Project"], workflow: geographyWorkflow },
          { id: "market-boundaries", label: "Market Boundaries", description: "Use the selected geography to establish the relevant released market context.", classification: "required", sources: ["Registration"], workflow: geographyWorkflow },
        ],
      },
      {
        id: "location-map-placement",
        label: "Location / Map Placement",
        description: "Capture the physical address and confirm map placement without conflating it with public precision.",
        classification: "required",
        sources: ["Registration", "Project"],
        workflow: geographyWorkflow,
        children: [
          { id: "physical-address", label: "Add Physical Address", description: "Enter the organization's base physical address.", classification: "required", sources: ["Registration"], workflow: geographyWorkflow },
          { id: "geocode-address", label: "Geocode Address", description: "Resolve the address through the Geography service/provider boundary.", classification: "required", sources: ["Registration"], workflow: geographyWorkflow },
          { id: "confirm-marker", label: "Confirm Marker Placement", description: "Confirm the resulting organization location before Geography completion.", classification: "required", sources: ["Registration"], workflow: geographyWorkflow },
        ],
      },
      {
        id: "visibility-preferences",
        label: "Visibility Preferences",
        description: "Control the public precision of organization location information.",
        classification: "required",
        sources: ["Onboarding", "Project"],
        workflow: geographyWorkflow,
        children: [
          { id: "exact", label: "Exact", description: "Allow exact public location where appropriate.", classification: "conditional", sources: ["Project"], workflow: geographyWorkflow },
          { id: "approximate", label: "Approximate", description: "Expose an approximate public location rather than the precise address.", classification: "conditional", sources: ["Project"], workflow: geographyWorkflow },
          { id: "locality-only", label: "Locality Only", description: "Expose only the locality for the public organization presence.", classification: "conditional", sources: ["Project"], workflow: geographyWorkflow },
        ],
      },
      {
        id: "service-geography",
        label: "Service Geography",
        description: "Describe where the organization can perform work separately from where it is based.",
        classification: "required",
        sources: ["Project"],
        workflow: geographyWorkflow,
      },
      { id: "review", label: "Review Geography", description: "Review the normalized Geography context before continuing to Organization Profile.", classification: "required", sources: ["Project"], workflow: geographyWorkflow },
    ],
  },
  profile: {
    subject: "profile",
    label: "Organization Profile",
    description: "Build the canonical Exchange-facing organization profile reused by every authenticated lens and cross-lens workflow.",
    step: 4,
    totalSteps: 6,
    classification: "required",
    workflow: profileWorkflow,
    children: [
      {
        id: "core-profile-details",
        label: "Core Profile Details",
        description: "Complete organization overview, contacts, description, and key information.",
        classification: "required",
        sources: ["Onboarding"],
        workflow: profileWorkflow,
        children: [
          { id: "organization-overview", label: "Organization Overview", description: "Describe the organization for Exchange participants.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "contacts", label: "Contacts", description: "Maintain the primary organization contact separately from the signed-in user's identity.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "description-key-info", label: "Description and Key Info", description: "Complete the descriptive information required for a useful profile.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
        ],
      },
      {
        id: "industry-services",
        label: "Industry & Services",
        description: "Select industries served and service offerings before detailed capability enrichment.",
        classification: "recommended",
        sources: ["Onboarding"],
        workflow: profileWorkflow,
        children: [
          { id: "industries-served", label: "Industries Served", description: "Identify the industries the organization serves.", classification: "recommended", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "service-offerings", label: "Service Offerings", description: "Describe service offerings that seed capability enrichment.", classification: "recommended", sources: ["Onboarding"], workflow: profileWorkflow },
        ],
      },
      {
        id: "roles-goals-visibility",
        label: "Role, Goals & Visibility",
        description: "Set participation roles, first-value goals, and discoverability preferences without forcing one account type.",
        classification: "required",
        sources: ["Onboarding", "Project"],
        workflow: profileWorkflow,
        children: [
          { id: "welcome-role-selection", label: "Welcome / Role Selection", description: "Select how the organization participates in RFxchange.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "visibility-preferences", label: "Visibility Preferences", description: "Control organization search, map, and contact visibility in the Profile workflow.", classification: "required", sources: ["Onboarding", "Project"], workflow: profileWorkflow },
          { id: "goals", label: "Goals", description: "Capture the intended first-value path for post-onboarding routing.", classification: "required", sources: ["Project"], workflow: profileWorkflow },
        ],
      },
    ],
  },
  capabilities: {
    subject: "capabilities",
    label: "Capability Enrichment",
    description: "Progressively enrich the organization from plain-language capability claims through AMACS assistance, evidence, and discoverability.",
    step: 5,
    totalSteps: 6,
    classification: "required",
    workflow: capabilitiesWorkflow,
    children: [
      { id: "core-profile-details", label: "Core Profile Details", description: "Review the organization overview, contacts, description, and key information used to seed enrichment.", classification: "required", sources: ["Onboarding"], workflow: profileWorkflow },
      {
        id: "industry-services",
        label: "Industry & Services",
        description: "Review industries served and service offerings that provide capability context.",
        classification: "recommended",
        sources: ["Onboarding"],
        workflow: profileWorkflow,
        children: [
          { id: "industries-served", label: "Industries Served", description: "Review the industries served by the organization.", classification: "recommended", sources: ["Onboarding"], workflow: profileWorkflow },
          { id: "service-offerings", label: "Service Offerings", description: "Review the organization's service offerings before capability entry.", classification: "recommended", sources: ["Onboarding"], workflow: profileWorkflow },
        ],
      },
      {
        id: "capabilities-entry",
        label: "Capabilities Entry",
        description: "Add detailed capabilities and solutions in plain language.",
        classification: "required",
        sources: ["Onboarding"],
        workflow: capabilitiesWorkflow,
        children: [
          { id: "detailed-capabilities", label: "Detailed Capabilities", description: "Describe what the organization can actually do.", classification: "required", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "solutions", label: "Solutions", description: "Add the solutions represented by the capability claims.", classification: "recommended", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
        ],
      },
      {
        id: "amacs-mapping",
        label: "AMACS Mapping / AI-to-AMACS Assistance",
        description: "Use assistance to propose structured AMACS alignment while keeping organization confirmation distinct from inference.",
        classification: "recommended",
        sources: ["Onboarding", "Capabilities"],
        workflow: capabilitiesWorkflow,
        children: [
          { id: "suggest-mapping", label: "Suggest AMACS Mapping", description: "Generate or retrieve mapping candidates through the future AMACS service boundary.", classification: "recommended", sources: ["Onboarding", "Capabilities"], workflow: capabilitiesWorkflow },
          { id: "review-confirm-mapping", label: "Review / Confirm Mapping", description: "Allow the organization to review and confirm a mapping before it becomes organization-asserted taxonomy truth.", classification: "recommended", sources: ["Onboarding", "Capabilities"], workflow: capabilitiesWorkflow },
        ],
      },
      {
        id: "evidence-certifications",
        label: "Evidence / Certifications",
        description: "Add evidence that supports capability claims without converting uploads into unsupported verification claims.",
        classification: "recommended",
        sources: ["Onboarding", "Capabilities"],
        workflow: capabilitiesWorkflow,
        children: [
          { id: "certifications", label: "Certifications", description: "Associate relevant certifications with capability claims.", classification: "recommended", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "licenses", label: "Licenses", description: "Associate licenses that support the capability profile.", classification: "recommended", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "case-studies", label: "Case Studies", description: "Associate case studies with applicable capabilities.", classification: "optional", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "supporting-documents", label: "Supporting Documents", description: "Attach supporting documents through the capability evidence workflow once object storage is connected.", classification: "optional", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
        ],
      },
      {
        id: "tags-keywords-specialties",
        label: "Tags / Keywords / Specialties",
        description: "Add discoverability terms without changing canonical AMACS taxonomy truth.",
        classification: "optional",
        sources: ["Onboarding"],
        workflow: capabilitiesWorkflow,
        children: [
          { id: "keywords", label: "Keywords", description: "Add alternate search terminology.", classification: "optional", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "specialties", label: "Specialties", description: "Add organization specialties that improve discovery.", classification: "optional", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
          { id: "tags", label: "Tags", description: "Add controlled discoverability tags where supported.", classification: "optional", sources: ["Onboarding"], workflow: capabilitiesWorkflow },
        ],
      },
    ],
  },
  membership: {
    subject: "membership",
    label: "Membership",
    description: "Resolve the organization's free or paid participation path without allowing payment to purchase authority or verification.",
    step: 5,
    totalSteps: 6,
    classification: "conditional",
    workflow: membershipWorkflow,
    children: [
      {
        id: "membership-selection",
        label: "Membership Selection",
        description: "Choose the organization's participation plan.",
        classification: "conditional",
        sources: ["Registration", "Project"],
        workflow: membershipWorkflow,
        children: [
          { id: "founding-membership", label: "Founding Membership ($49/mo)", description: "Select the Founding Membership offer when available.", classification: "optional", sources: ["Registration", "Project"], workflow: { ...membershipWorkflow, href: "/onboarding/membership?membership=founding" } },
          { id: "future-plans", label: "Future Plans as Available", description: "Review future plan options only when the Membership catalog exposes them.", classification: "optional", sources: ["Registration"], workflow: membershipWorkflow },
          { id: "continue-free", label: "Continue Free", description: "Continue through core Exchange readiness without making paid membership a universal access gate.", classification: "optional", sources: ["Project"], workflow: membershipWorkflow },
        ],
      },
      {
        id: "payment",
        label: "Payment (Stripe)",
        description: "Complete payment only for a selected paid plan through the Membership-owned Stripe checkout boundary.",
        classification: "conditional",
        sources: ["Registration"],
        workflow: { ...membershipWorkflow, href: "/onboarding/membership?membership=founding" },
        children: [
          { id: "enter-payment-details", label: "Enter Payment Details", description: "Collect payment details in the secure Stripe-owned checkout experience, not in Detail Surface.", classification: "conditional", sources: ["Registration"], workflow: { ...membershipWorkflow, href: "/onboarding/membership?membership=founding" } },
          { id: "secure-checkout", label: "Secure Checkout", description: "Use the Membership workflow's Stripe integration rather than storing card data in RFxchange UI state.", classification: "conditional", sources: ["Registration"], workflow: { ...membershipWorkflow, href: "/onboarding/membership?membership=founding" } },
          { id: "payment-confirmation", label: "Payment Confirmation", description: "Return confirmed payment/entitlement state to onboarding before readiness evaluation.", classification: "conditional", sources: ["Registration"], workflow: { ...membershipWorkflow, href: "/onboarding/membership?membership=founding" } },
        ],
      },
    ],
  },
  readiness: {
    subject: "readiness",
    label: "Exchange-ready Completion",
    description: "Evaluate required and recommended onboarding outcomes, resolve blocking items, then activate the handoff to the existing Exchange shell.",
    step: 6,
    totalSteps: 6,
    classification: "required",
    workflow: completionWorkflow,
    children: [
      {
        id: "review-completion-checkpoint",
        label: "Review & Completion Checkpoint",
        description: "Review required/recommended completeness and route missing items back to their owning workflow.",
        classification: "required",
        sources: ["Onboarding"],
        workflow: completionWorkflow,
        children: [
          { id: "completeness-check", label: "Completeness Check", description: "Check required and recommended onboarding items through the Readiness service.", classification: "required", sources: ["Onboarding"], workflow: completionWorkflow },
          { id: "missing-items", label: "Missing Items / Actionable Prompts", description: "Surface blocking or recommended items as links back into the applicable nested Detail/owning workflow.", classification: "required", sources: ["Onboarding"], workflow: completionWorkflow },
          { id: "save-continue-later", label: "Save and Continue Later", description: "Persist progress through the owning onboarding services; Detail Surface itself does not keep a browser-only shadow copy.", classification: "recommended", sources: ["Onboarding"], workflow: completionWorkflow },
          { id: "profile-completeness-indicator", label: "Profile Completeness Indicator", description: "Use the indicator as guidance toward Exchange readiness without treating optional enrichment as a blocking gate.", classification: "recommended", sources: ["Onboarding"], workflow: completionWorkflow },
        ],
      },
      {
        id: "exchange-ready",
        label: "Exchange Ready",
        description: "Activate organization presence and enter the existing authenticated Exchange shell after all blocking readiness gates pass.",
        classification: "required",
        sources: ["Onboarding", "Registration"],
        workflow: { href: "/onboarding/completion", label: "Activate Exchange handoff", service: activationService },
        children: [
          { id: "listed-presence", label: "Listed / Presence in Exchange", description: "Activate the organization's permitted marker or off-map Exchange presence.", classification: "required", sources: ["Onboarding"], workflow: { href: "/onboarding/completion", label: "Activate organization presence", service: activationService } },
          { id: "browse-exchange", label: "Browse RFx, Resources, Intelligence, and Capabilities", description: "Enter the existing authenticated Exchange after activation rather than an onboarding-only home.", classification: "required", sources: ["Onboarding"], workflow: { href: "/exchange", label: "Enter the Exchange" } },
          { id: "profile-through-menu", label: "Profile Available Through Menu", description: "Manage the canonical organization profile through the authenticated Menu surface after entry.", classification: "recommended", sources: ["Onboarding"], workflow: { href: "/exchange", label: "Open the Exchange" } },
        ],
      },
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

export function getOnboardingDetailNode(
  subject: OnboardingDetailSubject,
  path: readonly string[],
): OnboardingDetailDefinition | OnboardingDetailNode | null {
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

export function getOnboardingDetailBreadcrumbs(
  subject: OnboardingDetailSubject,
  path: readonly string[],
): readonly OnboardingDetailBreadcrumb[] {
  const definition = definitions[subject];
  const crumbs: OnboardingDetailBreadcrumb[] = [
    { label: definition.label, href: onboardingDetailHref(subject) },
  ];
  let children: readonly OnboardingDetailNode[] = definition.children;
  const accumulated: string[] = [];

  for (const segment of path) {
    const node = children.find((candidate) => candidate.id === segment);
    if (!node) break;
    accumulated.push(segment);
    crumbs.push({ label: node.label, href: onboardingDetailHref(subject, accumulated) });
    children = node.children ?? [];
  }
  return crumbs;
}

export function getOnboardingDetailParentHref(subject: OnboardingDetailSubject, path: readonly string[]): string {
  return path.length === 0 ? "/onboarding/detail" : onboardingDetailHref(subject, path.slice(0, -1));
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
