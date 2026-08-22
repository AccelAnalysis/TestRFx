import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { ResourceProviderClass, ResourceParticipationPolicy } from "./provider-classification";

export type ResourceProviderClaimState = "unclaimed" | "claimed" | "verified";

export interface ResourceProviderSourceProjection {
  sourceKey: string;
  sourceName: string;
  sourceUrl?: string;
  authority: "authoritative" | "licensed" | "curated" | "preview";
  lastCheckedAt?: string;
}

export interface ResourceProviderListingProjection {
  organizationId?: string;
  providerType: string;
  providerClass: ResourceProviderClass;
  participationPolicy: ResourceParticipationPolicy;
  claimState: ResourceProviderClaimState;
  classificationBasis: string;
  source: ResourceProviderSourceProjection;
  marketKey?: string;
}

export type ResourceProviderExchangeRecord = ExchangeRecord & {
  resourceProvider: ResourceProviderListingProjection;
};

export function getResourceProviderListing(record: ExchangeRecord): ResourceProviderListingProjection | undefined {
  if (record.type !== "resource") return undefined;
  return (record as ExchangeRecord & { resourceProvider?: ResourceProviderListingProjection }).resourceProvider;
}

export function isUnclaimedResourceProvider(record: ExchangeRecord) {
  return getResourceProviderListing(record)?.claimState === "unclaimed";
}
