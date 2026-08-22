import type { Coordinates, ExchangeCardMedia, ExchangeCardOrganizationMedia, ExchangeRecord } from "@/lib/exchange/contracts";

export type CapabilityMappingStatus = "suggested" | "accepted" | "needs-review";
export type CapabilityPublicationStatus = "draft" | "ready" | "published";
export type CapabilityEvidenceState = "claimed" | "supported" | "review-needed";
export type CapabilityEvidenceKind = "certification" | "license" | "past-performance" | "case-study" | "document" | "link";
export type CapabilityMatchCoverage = "strong" | "partial" | "gap";
export interface CapabilityEvidenceItem { id: string; kind: CapabilityEvidenceKind; label: string; issuer?: string; note?: string; }
export interface CapabilityClaim { id: string; name: string; description: string; amacsNodeId?: string; amacsLabel?: string; mappingStatus: CapabilityMappingStatus; publicationStatus: CapabilityPublicationStatus; evidenceState: CapabilityEvidenceState; evidence: CapabilityEvidenceItem[]; specialties: string[]; }
export interface CapabilityGap { id: string; label: string; reason: string; suggestedSearch: string; }
export interface CapabilityRfxMatch { id: string; title: string; issuer: string; coverage: CapabilityMatchCoverage; summary: string; }
export interface CapabilityOrganizationProfile {
  exchangeRecordId: string; organizationId?: string; organizationName: string; summary: string; geography: string; serviceAreas: string[]; keywords: string[];
  capabilities: CapabilityClaim[]; profileStrength: number; gaps: CapabilityGap[]; rfxMatches: CapabilityRfxMatch[];
  location?: Coordinates; ownedByViewer?: boolean; featured?: boolean; saved?: boolean;
  cardMedia?: ExchangeCardMedia; organizationMedia?: ExchangeCardOrganizationMedia;
}
export function capabilityEvidenceCount(profile: CapabilityOrganizationProfile) { return profile.capabilities.reduce((total, capability) => total + capability.evidence.length, 0); }
export function capabilityMappedCount(profile: CapabilityOrganizationProfile) { return profile.capabilities.filter((capability) => capability.mappingStatus === "accepted" && capability.amacsNodeId).length; }
export function capabilityProfileToExchangeRecord(profile: CapabilityOrganizationProfile): ExchangeRecord {
  const leadCapability = profile.capabilities[0]?.name ?? "Capability profile";
  const mapped = capabilityMappedCount(profile); const evidence = capabilityEvidenceCount(profile);
  const searchableCapabilityTerms = profile.capabilities.flatMap((capability) => [capability.name, capability.amacsNodeId ?? "", capability.amacsLabel ?? "", ...capability.specialties]);
  return {
    id: profile.exchangeRecordId, type: "capability", title: leadCapability, organization: profile.organizationName, summary: profile.summary, geography: profile.geography,
    metadata: [...searchableCapabilityTerms, ...profile.keywords, ...profile.serviceAreas, `${mapped} AMACS mapped`, `${evidence} evidence items`].filter(Boolean),
    location: profile.location, ownedByViewer: profile.ownedByViewer, featured: profile.featured, saved: profile.saved,
    card: {
      eyebrow: "Organization capability profile",
      media: profile.cardMedia,
      organizationMedia: profile.organizationMedia,
      classifications: profile.capabilities.slice(0, 3).map((capability) => capability.name),
      relationships: !profile.ownedByViewer && profile.saved ? ["following"] : undefined,
      placement: profile.featured ? "featured" : "organic",
    },
  };
}
