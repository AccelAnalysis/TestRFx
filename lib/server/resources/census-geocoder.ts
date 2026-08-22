import type { ProviderGeocodeAddress, ProviderGeocodeResult } from "@/lib/resources/provider-geocoding";

const CENSUS_GEOCODER_STRUCTURED_URL = "https://geocoding.geo.census.gov/geocoder/locations/address";
const CENSUS_GEOCODER_ONELINE_URL = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress";
export const CENSUS_GEOCODER_BENCHMARK = "Public_AR_Current";

type CensusAddressMatch = {
  matchedAddress?: string;
  coordinates?: { x?: number; y?: number };
  addressComponents?: { state?: string; zip?: string; city?: string };
  tigerLine?: Record<string, unknown>;
};

function stripSecondaryUnit(value: string) {
  return value
    .replace(/\s*,?\s*(suite|ste|unit|office|floor|fl|building|bldg)\s+[a-z0-9-]+.*$/i, "")
    .replace(/\s*,?\s*#\s*[a-z0-9-]+.*$/i, "")
    .trim();
}

function normalizeLeadingNumberWord(value: string) {
  return value.replace(/^one\b/i, "1").replace(/^two\b/i, "2").replace(/^three\b/i, "3");
}

function normalizeZip(value?: string) {
  return value?.trim().slice(0, 5) ?? "";
}

function normalizeState(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

async function fetchMatches(url: string): Promise<CensusAddressMatch[]> {
  const response = await fetch(url, {
    headers: { "user-agent": "RFxchange-Resource-Provider-Geocoder/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Census geocoder returned HTTP ${response.status}.`);
  const body = await response.json() as { result?: { addressMatches?: CensusAddressMatch[] } };
  return Array.isArray(body.result?.addressMatches) ? body.result!.addressMatches! : [];
}

async function lookupMatches(address: ProviderGeocodeAddress) {
  const street = normalizeLeadingNumberWord(stripSecondaryUnit(address.addressLine1));
  const structured = new URLSearchParams({
    street,
    city: address.locality,
    state: address.region,
    zip: address.postalCode ?? "",
    benchmark: CENSUS_GEOCODER_BENCHMARK,
    format: "json",
  });
  let matches = await fetchMatches(`${CENSUS_GEOCODER_STRUCTURED_URL}?${structured.toString()}`);
  if (matches.length) return { matches, lookupForm: "structured" };

  const oneLineAddress = [street, address.locality, address.region, address.postalCode].filter(Boolean).join(", ");
  const oneLine = new URLSearchParams({ address: oneLineAddress, benchmark: CENSUS_GEOCODER_BENCHMARK, format: "json" });
  matches = await fetchMatches(`${CENSUS_GEOCODER_ONELINE_URL}?${oneLine.toString()}`);
  return { matches, lookupForm: "oneline_fallback" };
}

export async function censusGeocodeAddress(address: ProviderGeocodeAddress): Promise<ProviderGeocodeResult> {
  let lookup;
  try {
    lookup = await lookupMatches(address);
  } catch (error) {
    return {
      status: "failed",
      provider: "census",
      benchmark: CENSUS_GEOCODER_BENCHMARK,
      reason: error instanceof Error ? error.message : "Census geocoder request failed.",
    };
  }

  const { matches, lookupForm } = lookup;
  if (matches.length !== 1) {
    return {
      status: matches.length ? "review" : "failed",
      provider: "census",
      benchmark: CENSUS_GEOCODER_BENCHMARK,
      matchType: matches.length ? "multiple_matches" : "no_match",
      reason: matches.length ? `Census returned ${matches.length} matches.` : "Census returned no address match.",
      payload: { matchCount: matches.length, lookupForm },
    };
  }

  const match = matches[0];
  const latitude = Number(match.coordinates?.y);
  const longitude = Number(match.coordinates?.x);
  const requestedState = normalizeState(address.region);
  const matchedState = normalizeState(match.addressComponents?.state);
  const requestedZip = normalizeZip(address.postalCode);
  const matchedZip = normalizeZip(match.addressComponents?.zip);
  const stateMatches = Boolean(requestedState && matchedState && requestedState === matchedState);
  const zipMatches = !requestedZip || Boolean(matchedZip && requestedZip === matchedZip);
  const coordinatesUsable = Number.isFinite(latitude)
    && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180 && longitude <= 180;

  const payload = { addressComponents: match.addressComponents ?? {}, tigerLine: match.tigerLine ?? {}, lookupForm };
  if (!stateMatches || !zipMatches || !coordinatesUsable) {
    return {
      status: "review",
      provider: "census",
      benchmark: CENSUS_GEOCODER_BENCHMARK,
      matchType: "single_match_requires_review",
      matchedAddress: match.matchedAddress,
      latitude: coordinatesUsable ? latitude : undefined,
      longitude: coordinatesUsable ? longitude : undefined,
      reason: !stateMatches ? "Matched state differs from sourced address." : !zipMatches ? "Matched ZIP differs from sourced address." : "Matched coordinates are invalid.",
      payload,
    };
  }

  return {
    status: "accepted",
    provider: "census",
    benchmark: CENSUS_GEOCODER_BENCHMARK,
    matchType: "single_match_state_zip",
    matchedAddress: match.matchedAddress,
    latitude,
    longitude,
    payload,
  };
}
