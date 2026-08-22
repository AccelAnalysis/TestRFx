import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { buildOrganizationHref } from "@/lib/onboarding/organization";
import { getResourceProviderListing } from "./provider-listing";

export function resourceProviderClaimHref(record: ExchangeRecord) {
  const provider = getResourceProviderListing(record);
  if (!provider || provider.claimState !== "unclaimed") return undefined;
  const context = {
    source: "resource-unclaimed-listing",
    organizationId: provider.organizationId,
    returnTo: `/exchange/resources/${encodeURIComponent(record.id)}`,
  };
  return buildOrganizationHref(provider.organizationId ? "existing.review" : "existing.search", context);
}
