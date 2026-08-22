import type { ResourceCategoryId } from "./provider-classification";

export type MarketSeedPackStatus = "definition" | "active" | "paused";

export interface MarketSeedPackSourceTarget {
  sourceKey: string;
  label: string;
  providerTypes: string[];
  categories: ResourceCategoryId[];
  authority: "authoritative" | "licensed" | "curated";
}

export interface MarketSeedPackDefinition {
  key: string;
  label: string;
  description: string;
  geography: {
    country: "US";
    state?: string;
    marketLabel: string;
  };
  status: MarketSeedPackStatus;
  sourceTargets: MarketSeedPackSourceTarget[];
}

const baselineSourceTargets: MarketSeedPackSourceTarget[] = [
  {
    sourceKey: "public-economic-development",
    label: "Official economic-development and local-government sources",
    providerTypes: ["economic-development-office", "economic-development-authority", "regional-development-organization", "local-government"],
    categories: ["economic_business_development", "community_institutional_resources", "real_estate_site_resources"],
    authority: "authoritative",
  },
  {
    sourceKey: "public-business-assistance",
    label: "Official small-business, procurement, workforce, and export assistance sources",
    providerTypes: ["sbdc", "score", "wbc", "vboc", "apex-accelerator", "workforce-board", "export-assistance-center"],
    categories: ["entrepreneurship_startup_support", "procurement_government_contracting", "workforce_talent", "export_trade_market_expansion", "mentoring_advisory"],
    authority: "authoritative",
  },
  {
    sourceKey: "institutional-business-network",
    label: "Chambers, universities, colleges, libraries, foundations, and nonprofit business-support organizations",
    providerTypes: ["chamber-of-commerce", "nonprofit-business-association", "public-university", "community-college", "public-library", "foundation", "nonprofit-incubator", "makerspace"],
    categories: ["business_associations_networks", "entrepreneurship_startup_support", "workspace_business_facilities", "workforce_talent", "community_institutional_resources", "innovation_technology_research"],
    authority: "curated",
  },
  {
    sourceKey: "regulated-financial-institutions",
    label: "Regulated banks, credit unions, and qualifying capital providers",
    providerTypes: ["bank", "credit-union", "cdfi", "commercial-lender"],
    categories: ["capital_finance"],
    authority: "authoritative",
  },
  {
    sourceKey: "commercial-business-services",
    label: "Licensed or curated commercial business-service providers",
    providerTypes: ["coworking-space", "commercial-incubator", "commercial-kitchen", "professional-services-firm", "staffing-firm", "private-training-provider", "commercial-real-estate", "connectivity-provider"],
    categories: ["workspace_business_facilities", "technical_professional_assistance", "workforce_talent", "real_estate_site_resources", "connectivity_infrastructure"],
    authority: "licensed",
  },
];

export const marketSeedPacks: MarketSeedPackDefinition[] = [
  {
    key: "hampton-roads-va",
    label: "Hampton Roads, Virginia",
    description: "Baseline Resource Provider seed pack for the Hampton Roads market. Individual source adapters determine their own authoritative service territories; the pack itself does not fabricate MSA membership or coordinates.",
    geography: { country: "US", state: "VA", marketLabel: "Hampton Roads" },
    status: "definition",
    sourceTargets: baselineSourceTargets,
  },
  {
    key: "richmond-va",
    label: "Richmond, Virginia",
    description: "Reusable Resource Provider seed pack for the Richmond market using the same classification and provenance rules as Hampton Roads.",
    geography: { country: "US", state: "VA", marketLabel: "Richmond" },
    status: "definition",
    sourceTargets: baselineSourceTargets,
  },
];

export const marketSeedPackByKey = Object.fromEntries(marketSeedPacks.map((pack) => [pack.key, pack])) as Record<string, MarketSeedPackDefinition>;

export function getMarketSeedPack(key: string) {
  return marketSeedPackByKey[key];
}
