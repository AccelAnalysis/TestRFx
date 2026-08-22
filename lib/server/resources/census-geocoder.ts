import type { ProviderGeocodeAddress, ProviderGeocodeResult } from "@/lib/resources/provider-geocoding";

const CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/locations/address";
export const CENSUS_GEOCODER_BENCHMARK = "Public_AR_Current";

function stripSecondaryUnit(value: string) {
  return value
    .replace(/\s*,?\s*(suite|ste|unit|office|floor|fl|building|bldg)\s+[a-z0-9-]+.*$/i, "")
    .replace(/\s*,?\s*#\s*[a-z0-9-]+.*$/i, "")
    .trim();
}

function normalizeZip(value?: string) {
  return value?.trim().slice(0, 5) ?? "";
}

function normalizeState(value?: string) {
  return value?.trim().toUpperCase() ?? "";
}

export async function censusGeocodeAddress(address: ProviderGeocodeAddress): Promise<ProviderGeocodeResult> {
  const params = new URLSearchParams({
    street: stripSecondaryUnit(address.addressLine1),
    city: address.locality,
    state: address.region,
    zip: address.postalCode ?? "",
    benchmark: CENSUS_GEOCODER_BENCHMARK,
    format: "json",
  });

  const response = await fetch(`${CENSUS_GEOCODER_URL}?${params.toString()}`, {
    headers: { "user-agent": "RFxchange-Resource-Provider-Geocoder/1.0" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    return {
      status: "failed",
      provider: "census",
      benchmark: CENSUS_GEOCODER_BENCHMARK,
      reason: `Census geocoder returned HTTP ${response.status}.`,
    };
  }

  const body = await response.json() as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        coordinates?: { x?: number; y?: number };
        addressComponents?: { state?: string; zip?: string; city?: string };
        tigerLine?: Record<string, unknown>;
      }>;
    };
  };
  const matches = Array.isArray(body.result?.addressMatches) ? body.result!.addressMatches! : [];
  if (matches.length !== 1) {
    return {
      status: matches.length ? "review" : "failed",
      provider: "census",
      benchmark: CENSUS_GEOCODER_BENCHMARK,
      matchType: matches.length ? "multiple_matches" : "no_match",
      reason: matches.length ? `Census returned ${matches.length} matches.` : "Census returned no address match.",
      payload: { matchCount: matches.length },
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

  const payload = {
    addressComponents: match.addressComponents ?? {},
    tigerLine: match.tigerLine ?? {},
  };
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
