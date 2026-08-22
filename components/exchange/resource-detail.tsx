"use client";

import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { isResourceRecord } from "@/lib/exchange/resources";
import { getResourceProviderListing } from "@/lib/resources/provider-listing";
import { resourceProviderClaimHref } from "@/lib/resources/claim-handoff";
import styles from "./resources.module.css";
import providerStyles from "./resource-provider-listing.module.css";

export function ResourceDetail({ record }: { record: ExchangeRecord }) {
  if (!isResourceRecord(record)) return null;

  const provider = getResourceProviderListing(record);
  const claimHref = provider?.claimState === "unclaimed" ? resourceProviderClaimHref(record) : undefined;
  const mapLabel = record.location
    ? "Mapped public location"
    : record.resource.visibility === "service-area"
      ? "Service area only"
      : "Off-map resource";
  const providerClassLabel = provider?.providerClass === "community_institutional"
    ? "Community / Institutional"
    : provider?.providerClass === "commercial"
      ? "Commercial"
      : undefined;

  return (
    <>
      <div className={styles.detailGrid}>
        <div className={styles.detailItem}><span>Category</span><strong>{record.resource.category}</strong></div>
        <div className={styles.detailItem}><span>Availability</span><strong>{record.resource.availabilityLabel}</strong></div>
        <div className={styles.detailItem}><span>Capacity</span><strong>{record.resource.capacity ?? "Provider confirms capacity"}</strong></div>
        <div className={styles.detailItem}><span>Geography</span><strong>{record.resource.serviceArea ?? record.geography}</strong></div>
        <div className={styles.detailItem}><span>Map presence</span><strong>{mapLabel}</strong></div>
        <div className={styles.detailItem}><span>Provider</span><strong>{record.organization}</strong></div>
        {providerClassLabel ? <div className={styles.detailItem}><span>Provider class</span><strong>{providerClassLabel}</strong></div> : null}
        {provider ? <div className={styles.detailItem}><span>Listing status</span><strong>{provider.claimState === "unclaimed" ? "Unclaimed" : provider.claimState === "verified" ? "Verified" : "Claimed"}</strong></div> : null}
      </div>

      {provider ? (
        <section className={providerStyles.provenance} aria-label="Listing source and provenance">
          <h2>Listing source</h2>
          <p><strong>{provider.source.sourceName}</strong> · {provider.source.authority === "authoritative" ? "Authoritative source" : provider.source.authority === "licensed" ? "Licensed source" : provider.source.authority === "preview" ? "Static preview fixture" : "Curated source"}</p>
          {provider.source.lastCheckedAt ? <p>Last checked {new Date(provider.source.lastCheckedAt).toLocaleDateString()}</p> : null}
          {provider.source.sourceUrl ? <p><a href={provider.source.sourceUrl} target="_blank" rel="noreferrer">View source</a></p> : null}
          <p>Source attribution describes where RFxchange obtained the factual listing. It is not verification, sponsorship, recommendation, or endorsement.</p>
        </section>
      ) : null}

      {provider?.claimState === "unclaimed" ? (
        <section className={providerStyles.claimPanel} aria-label="Claim this Resource Provider listing">
          <h2>Claim this listing</h2>
          <p>If you are authorized to represent {record.organization}, claim the organization through RFxchange's existing organization-identity workflow. Claiming and correcting factual organization information is free.</p>
          <span className={providerStyles.policyNote}>
            {provider.participationPolicy === "free_standard"
              ? "Community / Institutional: standard Resource participation is free."
              : "Commercial: identity claim is free; commercial Resource publishing uses paid participation."}
          </span>
          {claimHref ? <p><a className={providerStyles.detailClaimLink} href={claimHref}>Claim {record.organization}</a></p> : null}
        </section>
      ) : null}

      {record.resource.terms ? <div className={styles.detailCallout}><p><strong>Resource terms:</strong> {record.resource.terms}</p></div> : null}
      <div className={styles.detailCallout}>
        <p><strong>Cross-lens referral:</strong> this Resource is eligible to pass its record identity into the shared Referral workflow. Referral composition, recipient policy/fee handling, and tracking remain owned by the chassis-level Referral service.</p>
        <button type="button" disabled title="Shared referral engine integration point">Refer this resource</button>
      </div>
    </>
  );
}
