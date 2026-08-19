import "server-only";

import type {
  BaseLocationDraft,
  GeocodeMatch,
  GeographyBounds,
  GeographyDraft,
  GeographyMismatch,
  GeographyOption,
  GeographyReleaseState,
  GeographyType,
} from "@/lib/onboarding/geography";

const STATE_COUNTY_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer";
const PLACES_SERVICE = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Places_CouSub_ConCity_SubMCD/MapServer";
const CENSUS_GEOCODER = "https://geocoding.geo.census.gov/geocoder/geographies/address";
const CURRENT_COUNTY_LAYER = 1;
const CURRENT_INCORPORATED_PLACE_LAYER = 4;
const CURRENT_CDP_LAYER = 5;
const DEFAULT_RELEASED_GEOIDS = "51093";

const stateFipsToAbbr: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE",
  "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA",
  "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN",
  "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM",
  "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA",
  "54": "WV", "55": "WI", "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR", "78": "VI",
};

type ArcGisAttributes = Record<string, string | number | null | undefined>;

type ArcGisFindResult = {
  layerId?: number;
  layerName?: string;
  attributes?: ArcGisAttributes;
};

type ArcGisFindResponse = {
  results?: ArcGisFindResult[];
  error?: { message?: string };
};

type ArcGisQueryResponse = {
  features?: Array<{ attributes?: ArcGisAttributes }>;
  extent?: { xmin?: number; ymin?: number; xmax?: number; ymax?: number };
  error?: { message?: string };
};

type CensusGeocoderResponse = {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: { x?: number; y?: number };
      addressComponents?: Record<string, string | undefined>;
      geographies?: Record<string, Array<Record<string, string | undefined>>>;
    }>;
  };
};

function releasedGeoids() {
  return new Set(
    (process.env.RFXCHANGE_RELEASED_GEOGRAPHY_IDS ?? DEFAULT_RELEASED_GEOIDS)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function limitedGeoids() {
  return new Set(
    (process.env.RFXCHANGE_LIMITED_GEOGRAPHY_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function restrictedGeoids() {
  return new Set(
    (process.env.RFXCHANGE_RESTRICTED_GEOGRAPHY_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function releaseStateFor(geoid: string): GeographyReleaseState {
  if (restrictedGeoids().has(geoid)) return "restricted";
  if (limitedGeoids().has(geoid)) return "limited";
  return releasedGeoids().has(geoid) ? "released" : "visible";
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function numberOrUndefined(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function stateCodeFrom(attributes: ArcGisAttributes) {
  const explicit = text(attributes.STUSAB).toUpperCase();
  if (explicit.length === 2) return explicit;
  return stateFipsToAbbr[text(attributes.STATE)] ?? "";
}

function typeForCountyName(name: string): GeographyType {
  return /\bcity$/i.test(name) ? "independent_city" : "county";
}

function normalizeOption(
  attributes: ArcGisAttributes,
  type: GeographyType,
  idPrefix: string,
  bounds?: GeographyBounds,
): GeographyOption | null {
  const geoid = text(attributes.GEOID);
  const name = text(attributes.NAME || attributes.BASENAME);
  const stateCode = stateCodeFrom(attributes);
  if (!geoid || !name || !stateCode) return null;
  const releaseState = releaseStateFor(geoid);
  const latitude = numberOrUndefined(attributes.CENTLAT ?? attributes.INTPTLAT);
  const longitude = numberOrUndefined(attributes.CENTLON ?? attributes.INTPTLON);
  return {
    id: `${idPrefix}:${geoid}`,
    geoid,
    name,
    stateCode,
    countryCode: "US",
    type,
    releaseState,
    primarySelectable: releaseState === "released",
    ...(latitude !== undefined && longitude !== undefined ? { centroid: { latitude, longitude } } : {}),
    ...(bounds ? { bounds } : {}),
    source: "census_tigerweb",
  };
}

async function censusJson<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "RFxchange-Geography/1.0" },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Census geography service returned ${response.status}.`);
  return (await response.json()) as T;
}

async function find(service: string, layers: string, query: string) {
  const url = new URL(`${service}/find`);
  url.searchParams.set("searchText", query);
  url.searchParams.set("contains", "true");
  url.searchParams.set("searchFields", "NAME,BASENAME");
  url.searchParams.set("layers", layers);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  const payload = await censusJson<ArcGisFindResponse>(url);
  if (payload.error) throw new Error(payload.error.message || "Census TIGERweb search failed.");
  return payload.results ?? [];
}

export async function searchGeographies(query: string): Promise<GeographyOption[]> {
  const term = query.trim().slice(0, 120);
  if (term.length < 2) return [];

  const [countyResults, placeResults] = await Promise.all([
    find(STATE_COUNTY_SERVICE, String(CURRENT_COUNTY_LAYER), term),
    find(PLACES_SERVICE, `${CURRENT_INCORPORATED_PLACE_LAYER},${CURRENT_CDP_LAYER}`, term),
  ]);

  const options: GeographyOption[] = [];
  for (const result of countyResults) {
    const attributes = result.attributes ?? {};
    const name = text(attributes.NAME || attributes.BASENAME);
    const option = normalizeOption(attributes, typeForCountyName(name), "county");
    if (option) options.push(option);
  }
  for (const result of placeResults) {
    const layerId = result.layerId ?? CURRENT_INCORPORATED_PLACE_LAYER;
    const type: GeographyType = layerId === CURRENT_CDP_LAYER ? "census_designated_place" : "incorporated_place";
    const option = normalizeOption(result.attributes ?? {}, type, `place-${layerId}`);
    if (option) options.push(option);
  }

  const deduped = [...new Map(options.map((option) => [option.id, option])).values()];
  return deduped
    .sort((a, b) => Number(b.primarySelectable) - Number(a.primarySelectable) || a.name.localeCompare(b.name))
    .slice(0, 20);
}

function parseOptionId(id: string) {
  const county = /^county:(\d{5})$/.exec(id);
  if (county) return { service: STATE_COUNTY_SERVICE, layer: CURRENT_COUNTY_LAYER, geoid: county[1], type: "county" as const, prefix: "county" };
  const place = /^place-(4|5):(\d{7})$/.exec(id);
  if (place) {
    const layer = Number(place[1]);
    return {
      service: PLACES_SERVICE,
      layer,
      geoid: place[2],
      type: (layer === CURRENT_CDP_LAYER ? "census_designated_place" : "incorporated_place") as GeographyType,
      prefix: `place-${layer}`,
    };
  }
  return null;
}

async function queryAttributes(service: string, layer: number, geoid: string) {
  const url = new URL(`${service}/${layer}/query`);
  url.searchParams.set("where", `GEOID='${geoid}'`);
  url.searchParams.set("outFields", "*");
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  const payload = await censusJson<ArcGisQueryResponse>(url);
  if (payload.error) throw new Error(payload.error.message || "Census TIGERweb lookup failed.");
  return payload.features?.[0]?.attributes;
}

async function queryBounds(service: string, layer: number, geoid: string): Promise<GeographyBounds | undefined> {
  const url = new URL(`${service}/${layer}/query`);
  url.searchParams.set("where", `GEOID='${geoid}'`);
  url.searchParams.set("returnExtentOnly", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "json");
  const payload = await censusJson<ArcGisQueryResponse>(url);
  const extent = payload.extent;
  if (!extent) return undefined;
  const west = numberOrUndefined(extent.xmin);
  const south = numberOrUndefined(extent.ymin);
  const east = numberOrUndefined(extent.xmax);
  const north = numberOrUndefined(extent.ymax);
  if (west === undefined || south === undefined || east === undefined || north === undefined) return undefined;
  return { west, south, east, north };
}

export async function resolveGeography(id: string): Promise<GeographyOption | null> {
  const parsed = parseOptionId(id);
  if (!parsed) return null;
  const [attributes, bounds] = await Promise.all([
    queryAttributes(parsed.service, parsed.layer, parsed.geoid),
    queryBounds(parsed.service, parsed.layer, parsed.geoid),
  ]);
  if (!attributes) return null;
  const name = text(attributes.NAME || attributes.BASENAME);
  const type = parsed.type === "county" ? typeForCountyName(name) : parsed.type;
  return normalizeOption(attributes, type, parsed.prefix, bounds);
}

function firstGeography(geographies: Record<string, Array<Record<string, string | undefined>>>, patterns: string[]) {
  for (const [key, values] of Object.entries(geographies)) {
    const normalized = key.toLowerCase();
    if (patterns.some((pattern) => normalized.includes(pattern)) && values.length) return values[0];
  }
  return undefined;
}

export async function geocodeAddress(address: BaseLocationDraft): Promise<GeocodeMatch> {
  const url = new URL(CENSUS_GEOCODER);
  url.searchParams.set("street", [address.address1, address.address2].filter(Boolean).join(" "));
  url.searchParams.set("city", address.city);
  url.searchParams.set("state", address.state);
  url.searchParams.set("zip", address.postalCode);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");

  const payload = await censusJson<CensusGeocoderResponse>(url);
  const match = payload.result?.addressMatches?.[0];
  const latitude = numberOrUndefined(match?.coordinates?.y);
  const longitude = numberOrUndefined(match?.coordinates?.x);
  if (!match?.matchedAddress || latitude === undefined || longitude === undefined) {
    throw new Error("The U.S. Census Geocoder could not match this address. Check the street, city, state, and ZIP code.");
  }

  const geographies = match.geographies ?? {};
  const county = firstGeography(geographies, ["counties", "county"]);
  const place = firstGeography(geographies, ["incorporated places", "census designated places"]);
  const stateCode = text(match.addressComponents?.state).toUpperCase();

  return {
    matchedAddress: match.matchedAddress,
    coordinates: { latitude, longitude },
    ...(county?.GEOID && county.NAME
      ? { county: { geoid: county.GEOID, name: county.NAME, stateCode } }
      : {}),
    ...(place?.GEOID && place.NAME
      ? { place: { geoid: place.GEOID, name: place.NAME, stateCode } }
      : {}),
    source: "census_geocoder",
  };
}

export async function resolveAddressMismatch(primary: GeographyOption, geocode: GeocodeMatch): Promise<GeographyMismatch> {
  const primaryIsCounty = primary.type === "county" || primary.type === "independent_city";
  const detectedGeoid = primaryIsCounty ? geocode.county?.geoid : geocode.place?.geoid;
  if (!detectedGeoid) return { status: "unresolved" };
  if (detectedGeoid === primary.geoid) return { status: "match" };

  const detectedId = primaryIsCounty
    ? `county:${detectedGeoid}`
    : geocode.place
      ? `place-${CURRENT_INCORPORATED_PLACE_LAYER}:${detectedGeoid}`
      : "";
  const detectedGeography = detectedId ? await resolveGeography(detectedId) : null;
  return { status: "mismatch", ...(detectedGeography ? { detectedGeography } : {}) };
}

export async function canonicalizeServiceGeographies(draft: GeographyDraft) {
  if (draft.serviceMode !== "localities") return [];
  const ids = [...new Set(draft.serviceGeographies.map((item) => item.id))].slice(0, 25);
  const resolved = await Promise.all(ids.map(resolveGeography));
  return resolved.filter((item): item is GeographyOption => Boolean(item));
}
