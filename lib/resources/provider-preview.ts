import type { ResourceProviderExchangeRecord } from "./provider-listing";

/**
 * Static-preview fixtures only. They demonstrate unclaimed Resource Provider
 * presentation without asserting that a real organization exists at these
 * coordinates. Runtime ingestion creates canonical organizations with source
 * provenance and real locations instead.
 */
export const resourceProviderPreviewSeed: ResourceProviderExchangeRecord[] = [
  {
    id: "res-seed-preview-community",
    type: "resource",
    title: "Business development and entrepreneur support",
    organization: "Reference Economic Development Office",
    summary: "Preview-only unclaimed institutional listing used to validate seeded provider marker, card, provenance, and claim behavior.",
    geography: "Hampton Roads, VA",
    metadata: ["Economic & Business Development", "Unclaimed listing", "Preview fixture"],
    location: { lat: 36.79, lng: -76.43 },
    card: {
      eyebrow: "Community Resource Provider",
      classifications: ["Economic Development", "Institutional"],
      status: { label: "Unclaimed", tone: "neutral" },
    },
    resource: {
      category: "Economic & Business Development",
      availability: "scheduled",
      availabilityLabel: "Provider confirmation required",
      serviceArea: "Hampton Roads",
      visibility: "public-location",
      status: "active",
    },
    resourceProvider: {
      providerType: "economic-development-office",
      providerClass: "community_institutional",
      participationPolicy: "free_standard",
      claimState: "unclaimed",
      classificationBasis: "Preview of default policy for an economic development office.",
      marketKey: "hampton-roads-va",
      source: {
        sourceKey: "preview-fixture",
        sourceName: "RFxchange static preview fixture",
        authority: "preview",
      },
    },
  },
  {
    id: "res-seed-preview-commercial",
    type: "resource",
    title: "Coworking and meeting space",
    organization: "Reference Coworking Provider",
    summary: "Preview-only unclaimed commercial listing used to validate the paid-provider classification and free identity-claim boundary.",
    geography: "Richmond, VA",
    metadata: ["Workspace & Business Facilities", "Commercial provider", "Unclaimed listing"],
    location: { lat: 37.54, lng: -77.44 },
    card: {
      eyebrow: "Commercial Resource Provider",
      classifications: ["Coworking", "Meeting Space"],
      status: { label: "Unclaimed", tone: "neutral" },
    },
    resource: {
      category: "Workspace & Business Facilities",
      availability: "scheduled",
      availabilityLabel: "Provider confirmation required",
      serviceArea: "Richmond",
      visibility: "public-location",
      status: "active",
    },
    resourceProvider: {
      providerType: "coworking-space",
      providerClass: "commercial",
      participationPolicy: "commercial_paid",
      claimState: "unclaimed",
      classificationBasis: "Preview of default policy for a commercial coworking provider.",
      marketKey: "richmond-va",
      source: {
        sourceKey: "preview-fixture",
        sourceName: "RFxchange static preview fixture",
        authority: "preview",
      },
    },
  },
];
