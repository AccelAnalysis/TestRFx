import type { Coordinates, ExchangeRecord } from "@/lib/exchange/contracts";

export type CapabilityMappingStatus = "suggested" | "accepted" | "needs-review";
export type CapabilityPublicationStatus = "draft" | "ready" | "published";
export type CapabilityEvidenceState = "claimed" | "supported" | "review-needed";
export type CapabilityEvidenceKind = "certification" | "license" | "past-performance" | "case-study" | "document" | "link";
export type CapabilityMatchCoverage = "strong" | "partial" | "gap" | "uncertain";
export interface CapabilityEvidenceItem { id: string; kind: CapabilityEvidenceKind; label: string; issuer?: string; note?: string; }
export interface CapabilityClaim { id: string; name: string; description: string; amacsNodeId?: string; amacsLabel?: string; mappingStatus: CapabilityMappingStatus; publicationStatus: CapabilityPublicationStatus; evidenceState: CapabilityEvidenceState; evidence: CapabilityEvidenceItem[]; specialties: string[]; }
export interface CapabilityGap { id: string; label: string; reason: string; suggestedSearch: string; }
export interface CapabilityRfxMatch { id: string; title: string; issuer: string; coverage: CapabilityMatchCoverage; summary: string; }
export type CapabilityRequirementState = "aligned" | "partial" | "missing" | "uncertain";
export interface CapabilityRequirementMatch { requirementId: string; label: string; state: CapabilityRequirementState; matchedCapabilityIds: string[]; reason: string; }
export interface CapabilityRfxMatchResult extends CapabilityRfxMatch { requirements: CapabilityRequirementMatch[]; aligned: number; partial: number; missing: number; uncertain: number; }
export interface CapabilityOrganizationProfile {
  exchangeRecordId: string; organizationName: string; summary: string; geography: string; serviceAreas: string[]; keywords: string[];
  capabilities: CapabilityClaim[]; profileStrength: number; gaps: CapabilityGap[]; rfxMatches: CapabilityRfxMatch[];
  location?: Coordinates; ownedByViewer?: boolean; featured?: boolean; saved?: boolean; updatedAt?: string; publishedAt?: string;
}

export type CapabilityCommand =
  | { type: "add-claim"; name: string; description: string; specialties?: string[] }
  | { type: "update-claim"; capabilityId: string; name?: string; description?: string; specialties?: string[]; publicationStatus?: CapabilityPublicationStatus }
  | { type: "set-amacs-mapping"; capabilityId: string; disposition: "accept" | "edit" | "reject"; amacsNodeId?: string; amacsLabel?: string }
  | { type: "add-evidence"; capabilityId: string; kind: CapabilityEvidenceKind; label: string; issuer?: string; note?: string }
  | { type: "remove-evidence"; capabilityId: string; evidenceId: string }
  | { type: "save-profile" }
  | { type: "publish-profile" };

export interface AmacsInterpretationCandidate { conceptId: string; label: string; definition?: string; score: number; source: "amacs-release"; }
export interface AmacsCandidateResponse { available: boolean; manualPath: true; amacsVersion: string; candidates: AmacsInterpretationCandidate[]; reason?: string; }

export function isLegacyReferenceAmacsNode(nodeId?: string) { return Boolean(nodeId?.startsWith("amacs.reference.")); }
export function capabilityEvidenceCount(profile: CapabilityOrganizationProfile) { return profile.capabilities.reduce((total, capability) => total + capability.evidence.length, 0); }
export function capabilityMappedCount(profile: CapabilityOrganizationProfile) { return profile.capabilities.filter((capability) => capability.mappingStatus === "accepted" && capability.amacsNodeId && !isLegacyReferenceAmacsNode(capability.amacsNodeId)).length; }
export function capabilityProfileToExchangeRecord(profile: CapabilityOrganizationProfile): ExchangeRecord {
  const leadCapability = profile.capabilities[0]?.name ?? "Capability profile";
  const mapped = capabilityMappedCount(profile); const evidence = capabilityEvidenceCount(profile);
  const searchableCapabilityTerms = profile.capabilities.flatMap((capability) => {
    const governedMapping = capability.amacsNodeId && !isLegacyReferenceAmacsNode(capability.amacsNodeId) ? [capability.amacsNodeId, capability.amacsLabel ?? ""] : [];
    return [capability.name, ...governedMapping, ...capability.specialties];
  });
  return {
    id: profile.exchangeRecordId, type: "capability", title: leadCapability, organization: profile.organizationName, summary: profile.summary, geography: profile.geography,
    metadata: [...searchableCapabilityTerms, ...profile.keywords, ...profile.serviceAreas, `${mapped} AMACS mapped`, `${evidence} evidence items`, `${profile.profileStrength}% profile strength`].filter(Boolean),
    location: profile.location, ownedByViewer: profile.ownedByViewer, featured: profile.featured, saved: profile.saved,
    card: {
      eyebrow: profile.ownedByViewer ? "Your capability profile" : "Organization capability profile",
      classifications: profile.capabilities.slice(0, 3).map((capability) => capability.name),
      status: { label: `${profile.profileStrength}% profile`, tone: profile.profileStrength >= 85 ? "success" : profile.profileStrength >= 70 ? "info" : "warning" },
      relationships: profile.ownedByViewer ? ["owned"] : profile.saved ? ["following"] : undefined,
      placement: profile.featured ? "featured" : "organic",
    },
  };
}
