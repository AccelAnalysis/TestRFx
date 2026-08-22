import { classifyResourceProvider, type ResourceProviderClass, type ResourceParticipationPolicy } from "./provider-classification";
import { getMarketSeedPack } from "./market-seed-packs";

export type ExternalSourceAuthority = "authoritative" | "licensed" | "curated";
export type IngestionCandidateState = "staged" | "ready" | "review_duplicate" | "duplicate_exact" | "rejected" | "promoted";

export interface ExternalSourceDescriptor {
  key: string;
  name: string;
  authority: ExternalSourceAuthority;
  sourceUrl?: string;
  licenseOrUseBasis: string;
}

export interface ProviderSourceCandidate {
  sourceRecordId: string;
  sourceUrl?: string;
  organizationName: string;
  website?: string;
  primaryDomain?: string;
  providerType: string;
  providerClassOverride?: ResourceProviderClass;
  classificationBasis?: string;
  resourceCategory: string;
  serviceName: string;
  serviceSummary: string;
  locality?: string;
  region?: string;
  postalCode?: string;
  addressLine1?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  contactEmail?: string;
  serviceArea?: string;
  raw?: Record<string, unknown>;
}

export interface NormalizedProviderCandidate extends ProviderSourceCandidate {
  normalizedName: string;
  normalizedDomain?: string;
  providerClass: ResourceProviderClass;
  participationPolicy: ResourceParticipationPolicy;
  classificationBasis: string;
  requiresClassificationReview: boolean;
  marketKey: string;
  marketLabel: string;
}

export function normalizeDomain(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return normalized || undefined;
}

export function normalizeProviderName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b(the|llc|l\.l\.c|inc|incorporated|corp|corporation|company|co)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeProviderCandidate(candidate: ProviderSourceCandidate, marketKey: string): NormalizedProviderCandidate {
  const market = getMarketSeedPack(marketKey);
  if (!market) throw new Error(`Unsupported market seed pack: ${marketKey}`);
  if (!candidate.organizationName.trim()) throw new Error("Provider candidate requires organizationName.");
  if (!candidate.sourceRecordId.trim()) throw new Error("Provider candidate requires sourceRecordId.");
  if (!candidate.serviceName.trim() || !candidate.serviceSummary.trim()) throw new Error("Provider candidate requires a sourced service name and summary.");

  const classification = classifyResourceProvider({
    providerType: candidate.providerType,
    overrideClass: candidate.providerClassOverride,
    overrideBasis: candidate.classificationBasis,
  });
  if (!classification) throw new Error(`Unknown provider type requires manual classification: ${candidate.providerType}`);

  return {
    ...candidate,
    sourceRecordId: candidate.sourceRecordId.trim(),
    organizationName: candidate.organizationName.trim(),
    website: candidate.website?.trim() || undefined,
    primaryDomain: normalizeDomain(candidate.primaryDomain ?? candidate.website),
    normalizedName: normalizeProviderName(candidate.organizationName),
    providerClass: classification.providerClass,
    participationPolicy: classification.participationPolicy,
    classificationBasis: classification.basis,
    requiresClassificationReview: classification.requiresReview,
    resourceCategory: candidate.resourceCategory.trim(),
    serviceName: candidate.serviceName.trim(),
    serviceSummary: candidate.serviceSummary.trim(),
    locality: candidate.locality?.trim() || undefined,
    region: candidate.region?.trim() || undefined,
    postalCode: candidate.postalCode?.trim() || undefined,
    addressLine1: candidate.addressLine1?.trim() || undefined,
    phone: candidate.phone?.trim() || undefined,
    contactEmail: candidate.contactEmail?.trim().toLowerCase() || undefined,
    serviceArea: candidate.serviceArea?.trim() || undefined,
    marketKey,
    marketLabel: market.label,
  };
}

export function candidateIdentityKey(candidate: Pick<NormalizedProviderCandidate, "normalizedName" | "normalizedDomain" | "locality" | "region">) {
  return [candidate.normalizedDomain ?? "", candidate.normalizedName, candidate.locality?.toLowerCase() ?? "", candidate.region?.toLowerCase() ?? ""].join("|");
}

export function coordinatesAreUsable(candidate: Pick<ProviderSourceCandidate, "latitude" | "longitude">) {
  return typeof candidate.latitude === "number"
    && Number.isFinite(candidate.latitude)
    && candidate.latitude >= -90
    && candidate.latitude <= 90
    && typeof candidate.longitude === "number"
    && Number.isFinite(candidate.longitude)
    && candidate.longitude >= -180
    && candidate.longitude <= 180;
}
