import "server-only";

import type {
  GeographyPoint,
  GeographyProfile,
  GeographyReference,
  PlatformGeographyType,
} from "@/lib/geography/contracts";

const CENSUS_ADDRESS_URL = "https://geocoding.geo.census.gov/geocoder/geographies/address";
const CENSUS_COORDINATES_URL = "https://geocoding.geo.census.gov/geocoder/geographies/coordinates";
export const CENSUS_GEOGRAPHY_BENCHMARK = "Public_AR_Current";
export const CENSUS_GEOGRAPHY_VINTAGE = "Current_Current";

type CensusAttributes = Record<string, string | number | null | undefined>;
type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: Record<string, string | undefined>;
  tigerLine?: Record<string, unknown>;
  geographies?: Record<string, CensusAttributes[]>;
};
type CensusResponse = {
  result?: {
    addressMatches?: CensusAddressMatch[];
    geographies?: Record<string, CensusAttributes[]>;
    input?: Record<string, unknown>;
  };
};

const stateFipsToAbbr: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
  "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
  "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
  "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

export interface CensusResolvedAddress {
  matchedAddress: string;
  coordinates: GeographyPoint;
  profile: GeographyProfile;
  addressComponents: Record<string, string | undefined>;
  tigerLine: Record<string, unknown>;
  rawGeographies: Record<string, CensusAttributes[]>;
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numeric(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function normalizeLayerName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function typeForLayer(layerName: string): PlatformGeographyType | undefined {
  const layer = normalizeLayerName(layerName);
  if (layer.includes("census block groups")) return "block_group";
  if (layer.includes("census blocks") || /^blocks?\b/.test(layer)) return "census_block";
  if (layer.includes("census tracts")) return "census_tract";
  if (layer.includes("combined statistical areas")) return "csa";
  if (layer.includes("metropolitan statistical areas") || layer.includes("metropolitan micropolitan statistical areas")) return "msa";
  if (layer.includes("zip code tabulation")) return "zip_zcta";
  if (layer.includes("congressional districts")) return "congressional_district";
  if (layer.includes("state legislative") && (layer.includes("upper") || layer.includes("senate"))) return "state_legislative_upper";
  if (layer.includes("state legislative") && (layer.includes("lower") || layer.includes("house"))) return "state_legislative_lower";
  if (layer.includes("unified school districts")) return "school_district_unified";
  if (layer.includes("elementary school districts")) return "school_district_elementary";
  if (layer.includes("secondary school districts")) return "school_district_secondary";
  if (layer.includes("county subdivisions")) return "county_subdivision";
  if (layer.includes("urban areas") || layer.includes("urbanized areas") || layer.includes("urban clusters")) return "urban_area";
  if (layer.includes("incorporated places") || layer.includes("census designated places")) return "place";
  if (layer.includes("counties")) return "county_equivalent";
  if (layer === "states" || layer.startsWith("states ")) return "state";
  return undefined;
}

function stateCode(attributes: CensusAttributes, fallback?: string) {
  const explicit = text(attributes.STUSAB).toUpperCase();
  if (explicit.length === 2) return explicit;
  const fips = text(attributes.STATE).padStart(2, "0");
  return stateFipsToAbbr[fips] ?? fallback?.toUpperCase();
}

function metadataFor(attributes: CensusAttributes) {
  const metadata: Record<string, string | number | boolean | null> = {};
  for (const key of ["STATE", "COUNTY", "TRACT", "BLKGRP", "BLOCK", "BASENAME", "LSADC", "FUNCSTAT", "MTFCC"]) {
    const value = attributes[key];
    if (typeof value === "string" || typeof value === "number" || value === null) metadata[key.toLowerCase()] = value;
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

function referenceFor(layerName: string, attributes: CensusAttributes, fallbackState?: string): GeographyReference | undefined {
  const type = typeForLayer(layerName);
  if (!type) return undefined;
  const geoid = text(attributes.GEOID || attributes.GEOIDFQ || attributes.GEOID10 || attributes.GEOID20);
  const name = text(attributes.NAME || attributes.NAMELSAD || attributes.BASENAME);
  if (!name || !geoid) return undefined;
  const state = stateCode(attributes, fallbackState);
  return {
    key: `census:${type}:${geoid}:${CENSUS_GEOGRAPHY_VINTAGE}`,
    type,
    name,
    countryCode: "US",
    ...(state ? { stateCode: state } : {}),
    geoid,
    externalId: geoid,
    source: "census_geocoder",
    sourceLayer: layerName,
    vintage: CENSUS_GEOGRAPHY_VINTAGE,
    metadata: metadataFor(attributes),
  };
}

function collectReferences(geographies: Record<string, CensusAttributes[]>, fallbackState?: string) {
  const refs: Array<{ layer: string; ref: GeographyReference }> = [];
  for (const [layer, values] of Object.entries(geographies)) {
    for (const attributes of values ?? []) {
      const ref = referenceFor(layer, attributes, fallbackState);
      if (ref) refs.push({ layer, ref });
    }
  }
  return refs;
}

function selectPlace(refs: Array<{ layer: string; ref: GeographyReference }>) {
  const places = refs.filter((item) => item.ref.type === "place");
  return places.find((item) => normalizeLayerName(item.layer).includes("incorporated"))?.ref ?? places[0]?.ref;
}

function buildProfile(
  geographies: Record<string, CensusAttributes[]>,
  point: GeographyPoint,
  derivedFrom: GeographyProfile["derivedFrom"],
  fallbackState?: string,
  matchedAddress?: string,
): GeographyProfile {
  const refs = collectReferences(geographies, fallbackState);
  const byType = (type: PlatformGeographyType) => refs.find((item) => item.ref.type === type)?.ref;
  const state = byType("state");
  const country: GeographyReference = {
    key: "census:country:US",
    type: "country",
    name: "United States",
    countryCode: "US",
    externalId: "US",
    code: "US",
    source: "census_geocoder",
    vintage: CENSUS_GEOGRAPHY_VINTAGE,
  };
  const hierarchy = {
    country,
    state,
    countyEquivalent: byType("county_equivalent"),
    place: selectPlace(refs),
    censusTract: byType("census_tract"),
    blockGroup: byType("block_group"),
    censusBlock: byType("census_block"),
  };
  const coreTypes = new Set<PlatformGeographyType>(["state", "county_equivalent", "place", "census_tract", "block_group", "census_block"]);
  const parallel = refs.map((item) => item.ref).filter((ref) => !coreTypes.has(ref.type));
  const uniqueParallel = [...new Map(parallel.map((ref) => [ref.key, ref])).values()];
  return {
    hierarchy,
    parallel: uniqueParallel,
    point,
    ...(matchedAddress ? { matchedAddress } : {}),
    derivedFrom,
    resolver: "US Census Geocoder geoLookup",
    benchmark: CENSUS_GEOGRAPHY_BENCHMARK,
    vintage: CENSUS_GEOGRAPHY_VINTAGE,
    resolvedAt: new Date().toISOString(),
  };
}

async function censusRequest(url: URL) {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "RFxchange-Platform-Geography/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`U.S. Census Geocoder returned HTTP ${response.status}.`);
  return await response.json() as CensusResponse;
}

function geographyObject(payload: CensusResponse, match?: CensusAddressMatch) {
  if (match?.geographies && Object.keys(match.geographies).length) return match.geographies;
  if (payload.result?.geographies && Object.keys(payload.result.geographies).length) return payload.result.geographies;
  return {};
}

export async function resolveCensusAddressProfile(address: {
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postalCode?: string;
}) {
  const url = new URL(CENSUS_ADDRESS_URL);
  url.searchParams.set("street", [address.address1, address.address2].filter(Boolean).join(" "));
  url.searchParams.set("city", address.city);
  url.searchParams.set("state", address.state);
  if (address.postalCode) url.searchParams.set("zip", address.postalCode);
  url.searchParams.set("benchmark", CENSUS_GEOGRAPHY_BENCHMARK);
  url.searchParams.set("vintage", CENSUS_GEOGRAPHY_VINTAGE);
  url.searchParams.set("layers", "all");
  url.searchParams.set("format", "json");

  const payload = await censusRequest(url);
  const matches = payload.result?.addressMatches ?? [];
  if (matches.length !== 1) throw new Error(matches.length ? `U.S. Census Geocoder returned ${matches.length} possible address matches.` : "U.S. Census Geocoder could not match this address.");
  const match = matches[0];
  const latitude = numeric(match.coordinates?.y);
  const longitude = numeric(match.coordinates?.x);
  if (!match.matchedAddress || latitude === undefined || longitude === undefined) throw new Error("U.S. Census Geocoder returned an incomplete address match.");
  const coordinates = { latitude, longitude };
  const geographies = geographyObject(payload, match);
  return {
    matchedAddress: match.matchedAddress,
    coordinates,
    profile: buildProfile(geographies, coordinates, "address", match.addressComponents?.state ?? address.state, match.matchedAddress),
    addressComponents: match.addressComponents ?? {},
    tigerLine: match.tigerLine ?? {},
    rawGeographies: geographies,
  } satisfies CensusResolvedAddress;
}

export async function resolveCensusCoordinateProfile(point: GeographyPoint): Promise<GeographyProfile> {
  const url = new URL(CENSUS_COORDINATES_URL);
  url.searchParams.set("x", String(point.longitude));
  url.searchParams.set("y", String(point.latitude));
  url.searchParams.set("benchmark", CENSUS_GEOGRAPHY_BENCHMARK);
  url.searchParams.set("vintage", CENSUS_GEOGRAPHY_VINTAGE);
  url.searchParams.set("layers", "all");
  url.searchParams.set("format", "json");
  const payload = await censusRequest(url);
  const geographies = geographyObject(payload);
  if (!Object.keys(geographies).length) throw new Error("U.S. Census geoLookup returned no geography for these coordinates.");
  return buildProfile(geographies, point, "coordinates");
}
