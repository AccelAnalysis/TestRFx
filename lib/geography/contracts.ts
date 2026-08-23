export const coreGeographyLevels = [
  "country",
  "state",
  "region_market",
  "county_equivalent",
  "place",
  "census_tract",
  "block_group",
  "census_block",
] as const;
export type CoreGeographyLevel = (typeof coreGeographyLevels)[number];

export const parallelGeographyTypes = [
  "county_subdivision",
  "msa",
  "csa",
  "planning_region",
  "zip_zcta",
  "congressional_district",
  "state_legislative_upper",
  "state_legislative_lower",
  "school_district_unified",
  "school_district_elementary",
  "school_district_secondary",
  "urban_area",
  "opportunity_zone",
  "enterprise_zone",
  "hubzone",
  "foreign_trade_zone",
  "economic_development_district",
  "redevelopment_zone",
  "industrial_development_zone",
  "tax_increment_financing_zone",
  "custom_economic_development_zone",
] as const;
export type ParallelGeographyType = (typeof parallelGeographyTypes)[number];
export type PlatformGeographyType = CoreGeographyLevel | ParallelGeographyType;

export type GeographySourceSystem =
  | "census_geocoder"
  | "census_tigerweb"
  | "rfxchange_market"
  | "federal_program"
  | "state_program"
  | "local_program"
  | "planning"
  | "postal"
  | "manual";

export type GeographyMetadataValue = string | number | boolean | null;

export interface GeographyReference {
  key: string;
  type: PlatformGeographyType;
  name: string;
  countryCode: string;
  stateCode?: string;
  geoid?: string;
  externalId?: string;
  code?: string;
  source: GeographySourceSystem;
  sourceLayer?: string;
  vintage?: string;
  economicDevelopmentZone?: boolean;
  metadata?: Record<string, GeographyMetadataValue>;
}

export interface GeographyHierarchy {
  country?: GeographyReference;
  state?: GeographyReference;
  regionMarket?: GeographyReference;
  countyEquivalent?: GeographyReference;
  place?: GeographyReference;
  censusTract?: GeographyReference;
  blockGroup?: GeographyReference;
  censusBlock?: GeographyReference;
}

export interface GeographyPoint {
  latitude: number;
  longitude: number;
}

export interface GeographyProfile {
  hierarchy: GeographyHierarchy;
  parallel: GeographyReference[];
  point?: GeographyPoint;
  matchedAddress?: string;
  derivedFrom: "address" | "coordinates" | "declared" | "source";
  resolver: string;
  benchmark?: string;
  vintage?: string;
  resolvedAt?: string;
}

export type GeographicScopeKind =
  | "organization_service_area"
  | "resource_service_area"
  | "rfx_performance_area"
  | "intelligence_analysis_area"
  | "capability_service_area";

export type GeographicScopeMode =
  | "geographies"
  | "address"
  | "point"
  | "polygon"
  | "radius"
  | "statewide"
  | "nationwide"
  | "remote";

export interface GeographicScopeAddress {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country?: string;
}

export interface GeographicScope {
  kind: GeographicScopeKind;
  mode: GeographicScopeMode;
  label?: string;
  geographies?: GeographyReference[];
  address?: GeographicScopeAddress;
  point?: GeographyPoint;
  radiusMeters?: number;
  sourceLocationId?: string;
  derivedProfile?: GeographyProfile;
}

export const geographyTypeLabels: Record<PlatformGeographyType, string> = {
  country: "Country",
  state: "State",
  region_market: "Region / Market",
  county_equivalent: "County / County Equivalent",
  place: "Place / Municipality",
  census_tract: "Census Tract",
  block_group: "Block Group",
  census_block: "Census Block",
  county_subdivision: "County Subdivision",
  msa: "Metropolitan Statistical Area",
  csa: "Combined Statistical Area",
  planning_region: "Planning Region",
  zip_zcta: "ZIP / ZCTA",
  congressional_district: "Congressional District",
  state_legislative_upper: "State Legislative District · Upper",
  state_legislative_lower: "State Legislative District · Lower",
  school_district_unified: "Unified School District",
  school_district_elementary: "Elementary School District",
  school_district_secondary: "Secondary School District",
  urban_area: "Urban Area",
  opportunity_zone: "Opportunity Zone",
  enterprise_zone: "Enterprise Zone",
  hubzone: "HUBZone",
  foreign_trade_zone: "Foreign-Trade Zone",
  economic_development_district: "Economic Development District",
  redevelopment_zone: "Redevelopment Zone",
  industrial_development_zone: "Industrial Development Zone",
  tax_increment_financing_zone: "Tax Increment Financing Zone",
  custom_economic_development_zone: "Economic Development Zone",
};

export function hierarchyGeographies(profile?: GeographyProfile) {
  if (!profile) return [];
  const hierarchy = profile.hierarchy;
  return [
    hierarchy.country,
    hierarchy.state,
    hierarchy.regionMarket,
    hierarchy.countyEquivalent,
    hierarchy.place,
    hierarchy.censusTract,
    hierarchy.blockGroup,
    hierarchy.censusBlock,
  ].filter((item): item is GeographyReference => Boolean(item));
}

export function allProfileGeographies(profile?: GeographyProfile) {
  if (!profile) return [];
  return [...hierarchyGeographies(profile), ...profile.parallel];
}

export function geographyDisplayLabel(profile?: GeographyProfile, fallback = "") {
  if (!profile) return fallback;
  const hierarchy = profile.hierarchy;
  const local = hierarchy.place ?? hierarchy.countyEquivalent ?? hierarchy.regionMarket ?? hierarchy.state ?? hierarchy.country;
  if (!local) return fallback;
  const state = hierarchy.state?.stateCode ?? local.stateCode;
  return state && local.type !== "state" ? `${local.name}, ${state}` : local.name;
}

export function profileMatchesGeography(
  profile: GeographyProfile | undefined,
  ids: string[] = [],
  types: PlatformGeographyType[] = [],
) {
  if (!ids.length && !types.length) return true;
  const geographies = allProfileGeographies(profile);
  if (!geographies.length) return false;
  const idMatch = !ids.length || ids.every((id) => geographies.some((item) => item.key === id || item.geoid === id || item.externalId === id));
  const typeMatch = !types.length || types.every((type) => geographies.some((item) => item.type === type));
  return idMatch && typeMatch;
}

const economicDevelopmentTypes = new Set<PlatformGeographyType>([
  "opportunity_zone",
  "enterprise_zone",
  "hubzone",
  "foreign_trade_zone",
  "economic_development_district",
  "redevelopment_zone",
  "industrial_development_zone",
  "tax_increment_financing_zone",
  "custom_economic_development_zone",
]);

export function isEconomicDevelopmentGeography(type: PlatformGeographyType) {
  return economicDevelopmentTypes.has(type);
}
