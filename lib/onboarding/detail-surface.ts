export const ONBOARDING_DETAIL_SUBJECTS = [
  "account",
  "organization",
  "authority",
  "geography",
  "profile",
  "capability",
  "evidence",
  "role-goals",
  "membership",
  "readiness",
] as const;

export type OnboardingDetailSubject = (typeof ONBOARDING_DETAIL_SUBJECTS)[number];
export type OnboardingDetailMode = "view" | "edit" | "review" | "resolve" | "confirm" | "verify";
export type OnboardingDetailStatus =
  | "complete"
  | "needs-action"
  | "needs-confirmation"
  | "pending"
  | "optional"
  | "blocked"
  | "not-applicable";

export type OnboardingDetailFieldKind = "text" | "textarea" | "select" | "toggle" | "status";
export type OnboardingDetailValue = string | boolean;

export interface OnboardingDetailField {
  id: string;
  label: string;
  kind: OnboardingDetailFieldKind;
  value: OnboardingDetailValue;
  required?: boolean;
  description?: string;
  options?: readonly string[];
}

export interface OnboardingDetailSection {
  id: string;
  title: string;
  description?: string;
  fields: readonly OnboardingDetailField[];
}

export interface OnboardingDetailGuidance {
  what: string;
  why: string;
  visibility: string;
  next: string;
}

export interface OnboardingDetailDefinition {
  subject: OnboardingDetailSubject;
  mode: OnboardingDetailMode;
  eyebrow: string;
  title: string;
  subjectLabel: string;
  step: number;
  totalSteps: number;
  required: boolean;
  status: OnboardingDetailStatus;
  statusLabel: string;
  completionSummary: string;
  guidance: OnboardingDetailGuidance;
  sections: readonly OnboardingDetailSection[];
  returnHref: string;
  nextHref: string;
  nextLabel: string;
}

const organizationOptions = ["Business", "Supplier", "Buyer", "Issuer", "Government", "EDO", "Resource Provider", "Nonprofit", "Other"] as const;
const publicPrecisionOptions = ["Exact", "Approximate", "Locality only"] as const;

const definitions: Record<OnboardingDetailSubject, OnboardingDetailDefinition> = {
  account: {
    subject: "account", mode: "verify", eyebrow: "Account & identity detail", title: "Confirm your account", subjectLabel: "Jordan Avery",
    step: 1, totalSteps: 6, required: true, status: "needs-confirmation", statusLabel: "Needs confirmation",
    completionSummary: "Email control and required acknowledgements must be established before organization onboarding can continue.",
    guidance: {
      what: "This surface describes the person-level RFxchange identity used to authenticate access.",
      why: "RFxchange must distinguish a verified user account from organization authority, organization verification, and paid membership.",
      visibility: "Authentication data is private. Public organization information is established later and separately.",
      next: "After account verification, resolve the organization this user represents.",
    },
    sections: [
      { id: "identity", title: "Identity", fields: [
        { id: "name", label: "Name", kind: "text", value: "Jordan Avery", required: true },
        { id: "email", label: "Email", kind: "text", value: "jordan@example.com", required: true },
        { id: "email-status", label: "Email verification", kind: "status", value: "Pending confirmation" },
      ] },
      { id: "acknowledgements", title: "Required acknowledgements", fields: [
        { id: "terms", label: "Terms accepted", kind: "toggle", value: true, required: true },
        { id: "platform-rules", label: "Platform Rules accepted", kind: "toggle", value: true, required: true },
        { id: "privacy", label: "Privacy acknowledgement", kind: "toggle", value: true, required: true },
      ] },
    ],
    returnHref: "/onboarding", nextHref: "/onboarding/organization", nextLabel: "Continue to organization",
  },
  organization: {
    subject: "organization", mode: "resolve", eyebrow: "Organization resolution detail", title: "Resolve the canonical organization", subjectLabel: "Your Organization",
    step: 2, totalSteps: 6, required: true, status: "needs-action", statusLabel: "Needs action",
    completionSummary: "Review the candidate before claiming or creating an organization so RFxchange does not create a duplicate identity.",
    guidance: {
      what: "Organization resolution determines which canonical RFxchange organization record this account will join.",
      why: "RFx, Resources, Intelligence, Capabilities, referrals, and Menu must all reuse one organization identity.",
      visibility: "Candidate matching signals are onboarding-only. Public profile fields are controlled later.",
      next: "After the organization is resolved, establish authority and membership before geography/profile enrichment.",
    },
    sections: [
      { id: "candidate", title: "Candidate organization", description: "Reference entity-resolution data only; production matching belongs behind the organization service boundary.", fields: [
        { id: "organization-name", label: "Organization name", kind: "text", value: "Your Organization", required: true },
        { id: "organization-type", label: "Organization type", kind: "select", value: "Business", options: organizationOptions, required: true },
        { id: "candidate-geography", label: "Candidate geography", kind: "text", value: "Isle of Wight, VA" },
        { id: "claim-state", label: "Claim state", kind: "status", value: "Seeded / unclaimed" },
      ] },
      { id: "resolution", title: "Resolution decision", fields: [
        { id: "matches", label: "This candidate is my organization", kind: "toggle", value: false, required: true },
        { id: "notes", label: "Resolution notes", kind: "textarea", value: "Review name, geography, domain, address, aliases, and existing claim state before creating a new record." },
      ] },
    ],
    returnHref: "/onboarding", nextHref: "/onboarding/detail/authority", nextLabel: "Continue to authority",
  },
  authority: {
    subject: "authority", mode: "verify", eyebrow: "Organization authority detail", title: "Establish organization authority", subjectLabel: "Your Organization",
    step: 2, totalSteps: 6, required: true, status: "pending", statusLabel: "Pending authority",
    completionSummary: "Organization membership and administrative authority are separate from public Verified Organization status.",
    guidance: {
      what: "Authority determines whether this user may administer the resolved organization.",
      why: "A verified email cannot silently grant organization control or overwrite another organization administrator.",
      visibility: "Authority evidence is private unless a separate public verification process publishes an approved status.",
      next: "Once authority is established, geography can safely bind to the canonical organization.",
    },
    sections: [{ id: "authority", title: "Authority pathway", fields: [
      { id: "requested-role", label: "Requested role", kind: "select", value: "Organization administrator", options: ["Organization administrator", "Member", "Contributor"], required: true },
      { id: "authority-path", label: "Authority method", kind: "select", value: "Organization-domain email", options: ["Organization-domain email", "Existing administrator invitation", "Administrator review", "Organization documentation", "Authoritative record"], required: true },
      { id: "authority-state", label: "Authority state", kind: "status", value: "Pending review" },
    ] }],
    returnHref: "/onboarding/organization", nextHref: "/onboarding/geography", nextLabel: "Continue to geography",
  },
  geography: {
    subject: "geography", mode: "confirm", eyebrow: "Geography & location detail", title: "Confirm where the organization is based and serves", subjectLabel: "Isle of Wight, VA",
    step: 3, totalSteps: 6, required: true, status: "needs-confirmation", statusLabel: "Needs confirmation",
    completionSummary: "Primary Exchange geography, physical location, public precision, and service geography remain distinct concepts.",
    guidance: {
      what: "Geography establishes the organization's spatial identity and initial Exchange context.",
      why: "RFxchange must know where an organization is based without assuming that its service territory is identical to its address.",
      visibility: "Public location precision can be exact, approximate, or locality-only; service geography may remain broader.",
      next: "After geography is confirmed, enrich the same canonical organization profile.",
    },
    sections: [
      { id: "location", title: "Base location", fields: [
        { id: "primary-locality", label: "Primary locality", kind: "text", value: "Isle of Wight County, VA", required: true },
        { id: "address", label: "Base address", kind: "text", value: "" },
        { id: "map-state", label: "Map placement", kind: "status", value: "Needs geocode confirmation" },
        { id: "public-precision", label: "Public map precision", kind: "select", value: "Locality only", options: publicPrecisionOptions, required: true },
      ] },
      { id: "service", title: "Service geography", fields: [
        { id: "service-area", label: "Where can this organization perform work?", kind: "textarea", value: "Hampton Roads and surrounding Virginia markets", required: true },
      ] },
    ],
    returnHref: "/onboarding/organization", nextHref: "/onboarding/organization-profile", nextLabel: "Continue to organization profile",
  },
  profile: {
    subject: "profile", mode: "edit", eyebrow: "Organization profile detail", title: "Build the Exchange-facing organization profile", subjectLabel: "Your Organization",
    step: 4, totalSteps: 6, required: true, status: "needs-action", statusLabel: "Needs 1 required item",
    completionSummary: "Profile Complete means required identity and discoverability fields are present; it does not mean the organization is verified.",
    guidance: {
      what: "The organization profile is the shared Exchange identity reused across all lenses and cross-lens workflows.",
      why: "A single canonical profile prevents RFx, Resources, Capabilities, and referrals from creating separate copies of the organization.",
      visibility: "Only fields enabled for Exchange visibility should be published; administrative account data remains private.",
      next: "Add at least one meaningful capability, then progressively enrich AMACS alignment and evidence.",
    },
    sections: [
      { id: "identity", title: "Exchange identity", fields: [
        { id: "profile-name", label: "Organization name", kind: "text", value: "Your Organization", required: true },
        { id: "profile-type", label: "Organization type", kind: "select", value: "Business", options: organizationOptions, required: true },
        { id: "overview", label: "Overview", kind: "textarea", value: "", required: true },
        { id: "website", label: "Website", kind: "text", value: "" },
      ] },
      { id: "visibility", title: "Visibility", fields: [
        { id: "exchange-visible", label: "Show profile in Exchange discovery", kind: "toggle", value: true, required: true },
        { id: "contact-visible", label: "Allow Exchange contact discovery", kind: "toggle", value: true },
      ] },
    ],
    returnHref: "/onboarding/geography", nextHref: "/onboarding/capabilities", nextLabel: "Continue to capabilities",
  },
  capability: {
    subject: "capability", mode: "edit", eyebrow: "Capability detail", title: "Describe one meaningful capability", subjectLabel: "Capability seed",
    step: 5, totalSteps: 6, required: true, status: "needs-action", statusLabel: "Needs capability description",
    completionSummary: "A plain-language capability can establish discoverability; AMACS mapping and evidence can continue progressively.",
    guidance: {
      what: "A capability describes what the organization can provide, perform, make, or support.",
      why: "Capabilities connect organization discovery to RFx matching, Intelligence, Resources, and future referral workflows.",
      visibility: "A capability claim may be published separately from its supporting evidence and verification state.",
      next: "Review AMACS suggestions, add evidence where useful, and decide publication intent before completion.",
    },
    sections: [
      { id: "claim", title: "Capability claim", fields: [
        { id: "capability-name", label: "Capability name", kind: "text", value: "", required: true },
        { id: "capability-description", label: "Plain-language description", kind: "textarea", value: "", required: true },
        { id: "industry", label: "Industries served", kind: "text", value: "" },
      ] },
      { id: "amacs", title: "AMACS alignment", description: "AMACS suggestions remain assistance until the organization confirms the mapping.", fields: [
        { id: "amacs-suggestion", label: "Suggested AMACS mapping", kind: "status", value: "Not yet suggested" },
        { id: "amacs-confirmed", label: "Organization confirmed mapping", kind: "toggle", value: false },
        { id: "evidence-state", label: "Evidence state", kind: "status", value: "Self-reported / no evidence attached" },
      ] },
    ],
    returnHref: "/onboarding/organization-profile", nextHref: "/onboarding/detail/evidence", nextLabel: "Review evidence options",
  },
  evidence: {
    subject: "evidence", mode: "review", eyebrow: "Evidence & credential detail", title: "Support a capability without overstating verification", subjectLabel: "Optional evidence",
    step: 5, totalSteps: 6, required: false, status: "optional", statusLabel: "Optional enrichment",
    completionSummary: "Uploaded evidence can support a claim, but upload alone does not create a Verified Organization or verified capability.",
    guidance: {
      what: "Evidence links certifications, licenses, documents, case studies, or other support to a capability claim.",
      why: "RFxchange needs provenance and auditability without converting self-submitted files into unsupported trust claims.",
      visibility: "Evidence may remain private while an approved public credential representation is displayed separately.",
      next: "Continue to discoverability, roles/goals, or readiness even when optional evidence is not supplied.",
    },
    sections: [{ id: "evidence", title: "Evidence record", fields: [
      { id: "evidence-type", label: "Evidence type", kind: "select", value: "Certification", options: ["Certification", "License", "Document", "Case study", "Past performance", "Other"] },
      { id: "issuer", label: "Issuer / source", kind: "text", value: "" },
      { id: "identifier", label: "Identifier", kind: "text", value: "" },
      { id: "verification-state", label: "Verification state", kind: "status", value: "Self-reported" },
    ] }],
    returnHref: "/onboarding/capabilities", nextHref: "/onboarding/detail/role-goals", nextLabel: "Continue without blocking",
  },
  "role-goals": {
    subject: "role-goals", mode: "edit", eyebrow: "Role, goals & visibility detail", title: "Tell RFxchange how this organization participates", subjectLabel: "Participation context",
    step: 5, totalSteps: 6, required: true, status: "complete", statusLabel: "Complete",
    completionSummary: "Roles describe how the organization participates; goals guide the first-value path after onboarding.",
    guidance: {
      what: "Roles and goals configure how RFxchange presents relevant opportunities and workflows.",
      why: "An organization may be a supplier, buyer, issuer, resource provider, partner, or several at once; the platform should not force one account type.",
      visibility: "Participation roles may be public; onboarding goals are product-personalization context and need not be public.",
      next: "Use this context to choose the most useful authenticated Exchange destination after readiness.",
    },
    sections: [{ id: "roles", title: "Participation", fields: [
      { id: "primary-role", label: "Primary role", kind: "select", value: "Business", options: organizationOptions, required: true },
      { id: "find-opportunities", label: "Find opportunities", kind: "toggle", value: true },
      { id: "find-teammates", label: "Find teammates", kind: "toggle", value: true },
      { id: "find-resources", label: "Find resources", kind: "toggle", value: false },
      { id: "explore-network", label: "Explore the network", kind: "toggle", value: true },
    ] }],
    returnHref: "/onboarding/capabilities", nextHref: "/onboarding/completion", nextLabel: "Review Exchange readiness",
  },
  membership: {
    subject: "membership", mode: "review", eyebrow: "Membership detail", title: "Review participation and optional membership", subjectLabel: "Organization participation",
    step: 5, totalSteps: 6, required: false, status: "optional", statusLabel: "Optional commercial decision",
    completionSummary: "Core Exchange readiness must remain distinct from commercial membership, Founding recognition, verification, and credibility states.",
    guidance: {
      what: "Membership describes commercial participation for the organization, not the user's organization role or public verification state.",
      why: "RFxchange should not let payment silently purchase credibility, qualification, or administrative authority.",
      visibility: "Billing details are private; approved commercial recognition may be shown separately where applicable.",
      next: "A free organization can continue to Exchange-ready review when the required identity and readiness gates are satisfied.",
    },
    sections: [{ id: "membership", title: "Commercial participation", fields: [
      { id: "plan", label: "Plan", kind: "select", value: "Free organization", options: ["Free organization", "Founding Membership — $49/month"] },
      { id: "founding-capacity", label: "Founding capacity", kind: "status", value: "Production capacity service not connected in reference chassis" },
      { id: "continue-free", label: "Continue without upgrade", kind: "toggle", value: true },
    ] }],
    returnHref: "/onboarding", nextHref: "/onboarding/completion", nextLabel: "Review Exchange readiness",
  },
  readiness: {
    subject: "readiness", mode: "review", eyebrow: "Exchange-ready review detail", title: "Resolve the remaining readiness gates", subjectLabel: "Your Organization",
    step: 6, totalSteps: 6, required: true, status: "needs-action", statusLabel: "1 blocking item",
    completionSummary: "Exchange readiness is a controlled handoff. Optional AMACS depth, evidence, certifications, media, and additional capabilities do not become artificial access gates.",
    guidance: {
      what: "Readiness is the final server-evaluated checkpoint before the canonical organization becomes active in the authenticated Exchange.",
      why: "Visited screens are not authoritative; the platform must re-evaluate the actual user, organization, geography, capability, visibility, and entitlement state.",
      visibility: "The readiness checklist is administrative. Published organization data appears only after its own visibility rules are satisfied.",
      next: "When every blocking item is resolved, activate the organization presence and enter the existing authenticated Exchange shell.",
    },
    sections: [
      { id: "required", title: "Required readiness", fields: [
        { id: "account-ready", label: "Account activated", kind: "status", value: "Complete" },
        { id: "organization-ready", label: "Organization resolved", kind: "status", value: "Complete" },
        { id: "authority-ready", label: "Authority / membership", kind: "status", value: "Complete" },
        { id: "geography-ready", label: "Geography confirmed", kind: "status", value: "Complete" },
        { id: "profile-ready", label: "Profile identity & visibility", kind: "status", value: "Complete" },
        { id: "capability-ready", label: "Meaningful capability", kind: "status", value: "Needs action" },
      ] },
      { id: "enrichment", title: "Progressive enrichment", fields: [
        { id: "amacs-depth", label: "AMACS depth", kind: "status", value: "Optional" },
        { id: "certifications", label: "Certifications / evidence", kind: "status", value: "Optional" },
        { id: "media", label: "Portfolio / media", kind: "status", value: "Optional" },
      ] },
    ],
    returnHref: "/onboarding", nextHref: "/exchange", nextLabel: "Enter the Exchange",
  },
};

export function isOnboardingDetailSubject(value: string): value is OnboardingDetailSubject {
  return (ONBOARDING_DETAIL_SUBJECTS as readonly string[]).includes(value);
}

export function getOnboardingDetailDefinition(subject: string): OnboardingDetailDefinition | null {
  return isOnboardingDetailSubject(subject) ? definitions[subject] : null;
}

export function listOnboardingDetailDefinitions(): readonly OnboardingDetailDefinition[] {
  return ONBOARDING_DETAIL_SUBJECTS.map((subject) => definitions[subject]);
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
