export const CAPABILITY_ENRICHMENT_SESSION_KEY = "rfxchange.capability-enrichment.v2";

export const CAPABILITY_ENRICHMENT_STAGES = [
  { id: "context", label: "Context", description: "Reuse what RFxchange already knows about the organization." },
  { id: "capabilities", label: "Capabilities", description: "Capture what the organization can actually do." },
  { id: "amacs", label: "AMACS", description: "Review or enter AMACS mapping information without inventing taxonomy matches." },
  { id: "evidence", label: "Evidence", description: "Associate licenses, certifications, projects, and other support metadata." },
  { id: "discoverability", label: "Discoverability", description: "Add specialties and search terminology without changing taxonomy truth." },
  { id: "review", label: "Review", description: "Find gaps and confirm the profile is useful enough to continue." },
  { id: "publish", label: "Visibility", description: "Choose draft or Exchange-ready intent before the final checkpoint." },
] as const;

export type CapabilityEnrichmentStageId = (typeof CAPABILITY_ENRICHMENT_STAGES)[number]["id"];
export type MappingStatus = "suggested" | "accepted" | "needs-review";
export type PublicationStatus = "draft" | "ready" | "published";
export type CapabilityProvenance = "entered-by-user";

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

export interface CapabilityEnrichmentSnapshot {
  stage: CapabilityEnrichmentStageId;
  capabilities: CapabilityDraft[];
  keywords: string[];
  updatedAt: string;
}

export function isCapabilityEnrichmentStageId(value: string | undefined): value is CapabilityEnrichmentStageId {
  return Boolean(value && CAPABILITY_ENRICHMENT_STAGES.some((stage) => stage.id === value));
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

  if (unmapped > 0) recommendations.push(`Review ${unmapped} capability ${unmapped === 1 ? "mapping" : "mappings"} when an authoritative AMACS node is known.`);
  if (unsupported > 0) recommendations.push(`Add supporting evidence to ${unsupported} capability ${unsupported === 1 ? "claim" : "claims"} when available.`);
  if (keywords.length < 3) recommendations.push("Add a few specialties or alternate search terms to improve discoverability without changing AMACS taxonomy truth.");
  if (recommendations.length === 0) recommendations.push("No blocking enrichment gaps are present. Continue to visibility and the Exchange-ready checkpoint.");

  return recommendations;
}