export const CAPABILITY_ENRICHMENT_SESSION_KEY = "rfxchange.capability-enrichment.reference.v1";

export const CAPABILITY_ENRICHMENT_STAGES = [
  { id: "context", label: "Context", description: "Reuse what RFxchange already knows about the organization." },
  { id: "capabilities", label: "Capabilities", description: "Capture what the organization can actually do." },
  { id: "amacs", label: "AMACS", description: "Review structured AMACS mapping candidates." },
  { id: "evidence", label: "Evidence", description: "Associate licenses, certifications, projects, and other support." },
  { id: "discoverability", label: "Discoverability", description: "Add specialties and search terminology without changing taxonomy truth." },
  { id: "review", label: "Review", description: "Find gaps and confirm the profile is useful enough to continue." },
  { id: "publish", label: "Visibility", description: "Choose draft or Exchange-visible intent before the next onboarding checkpoint." }
] as const;

export type CapabilityEnrichmentStageId = (typeof CAPABILITY_ENRICHMENT_STAGES)[number]["id"];
export type MappingStatus = "suggested" | "accepted" | "needs-review";
export type PublicationStatus = "draft" | "ready" | "published";
export type CapabilityProvenance = "suggested-from-profile" | "entered-by-user";

export interface OrganizationCapabilityContext {
  organizationName: string;
  description: string;
  industries: string[];
  services: string[];
  geography: string[];
}

export interface CapabilityEvidenceItem {
  id: string;
  kind: "certification" | "license" | "past-performance" | "case-study" | "document" | "link";
  label: string;
}

export interface CapabilityDraft {
  id: string;
  name: string;
  description: string;
  provenance: CapabilityProvenance;
  amacsNodeId?: string;
  amacsLabel?: string;
  mappingStatus: MappingStatus;
  evidence: CapabilityEvidenceItem[];
  publicationStatus: PublicationStatus;
}

export interface CapabilitySuggestion {
  id: string;
  name: string;
  description: string;
  amacsNodeId: string;
  amacsLabel: string;
}

export interface CapabilityEnrichmentSnapshot {
  stage: CapabilityEnrichmentStageId;
  capabilities: CapabilityDraft[];
  keywords: string[];
  updatedAt: string;
}

export const REFERENCE_ORGANIZATION_CONTEXT: OrganizationCapabilityContext = {
  organizationName: "Reference Organization",
  description: "A deterministic onboarding context used to prove the Capability Enrichment chassis boundary before production organization profile persistence is connected.",
  industries: ["Professional services", "Construction"],
  services: ["Project delivery", "Technical services"],
  geography: ["Local market", "Regional service area"]
};

export const REFERENCE_CAPABILITY_SUGGESTIONS: CapabilitySuggestion[] = [
  {
    id: "construction-management",
    name: "Construction Management",
    description: "Plan, coordinate, and oversee construction delivery across schedule, cost, quality, and stakeholder requirements.",
    amacsNodeId: "amacs.reference.construction-management",
    amacsLabel: "AMACS reference projection · Construction Management"
  },
  {
    id: "project-management",
    name: "Project Management",
    description: "Lead scoped work from planning through execution, controls, reporting, and closeout.",
    amacsNodeId: "amacs.reference.project-management",
    amacsLabel: "AMACS reference projection · Project Management"
  },
  {
    id: "technical-services",
    name: "Technical Services",
    description: "Provide specialized technical support, implementation, maintenance, or advisory services.",
    amacsNodeId: "amacs.reference.technical-services",
    amacsLabel: "AMACS reference projection · Technical Services"
  },
  {
    id: "supplier-coordination",
    name: "Supplier Coordination",
    description: "Coordinate vendors, subcontractors, inputs, and delivery dependencies supporting operational execution.",
    amacsNodeId: "amacs.reference.supplier-coordination",
    amacsLabel: "AMACS reference projection · Supplier Coordination"
  }
];

export const REFERENCE_DISCOVERABILITY_TERMS = [
  "project delivery",
  "technical support",
  "construction",
  "supplier coordination",
  "field operations",
  "regional delivery"
];

export function draftFromSuggestion(suggestion: CapabilitySuggestion): CapabilityDraft {
  return {
    id: suggestion.id,
    name: suggestion.name,
    description: suggestion.description,
    provenance: "suggested-from-profile",
    amacsNodeId: suggestion.amacsNodeId,
    amacsLabel: suggestion.amacsLabel,
    mappingStatus: "suggested",
    evidence: [],
    publicationStatus: "draft"
  };
}

export function calculateCapabilityProfileStrength(capabilities: CapabilityDraft[], keywords: string[]): number {
  if (capabilities.length === 0) return 0;

  const capabilityCoverage = Math.min(capabilities.length / 4, 1) * 35;
  const mappedCoverage = (capabilities.filter((item) => item.mappingStatus === "accepted").length / capabilities.length) * 25;
  const evidenceCoverage = (capabilities.filter((item) => item.evidence.length > 0).length / capabilities.length) * 25;
  const discoverabilityCoverage = Math.min(keywords.length / 4, 1) * 15;

  return Math.round(capabilityCoverage + mappedCoverage + evidenceCoverage + discoverabilityCoverage);
}

export function capabilityGapRecommendations(capabilities: CapabilityDraft[], keywords: string[]): string[] {
  if (capabilities.length === 0) {
    return ["Add at least one capability so RFxchange has something to match and display later."];
  }

  const recommendations: string[] = [];
  const unmapped = capabilities.filter((item) => item.mappingStatus !== "accepted").length;
  const unsupported = capabilities.filter((item) => item.evidence.length === 0).length;

  if (unmapped > 0) recommendations.push(`Review ${unmapped} capability ${unmapped === 1 ? "mapping" : "mappings"} before treating AMACS alignment as confirmed.`);
  if (unsupported > 0) recommendations.push(`Add supporting evidence to ${unsupported} capability ${unsupported === 1 ? "claim" : "claims"}.`);
  if (keywords.length < 3) recommendations.push("Add a few specialties or alternate search terms to improve discoverability without changing AMACS taxonomy truth.");
  if (recommendations.length === 0) recommendations.push("No blocking enrichment gaps are present in this reference profile. Continue to visibility and the Exchange-ready checkpoint.");

  return recommendations;
}
