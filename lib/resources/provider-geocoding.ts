export type ProviderGeocodeStatus = "pending" | "accepted" | "review" | "failed";
export type ProviderGeocodeSource = "census" | "manual";

export interface ProviderGeocodeAddress {
  addressLine1: string;
  locality: string;
  region: string;
  postalCode?: string;
}

export interface ProviderGeocodeResult {
  status: Exclude<ProviderGeocodeStatus, "pending">;
  provider: ProviderGeocodeSource;
  benchmark?: string;
  matchType?: string;
  matchedAddress?: string;
  latitude?: number;
  longitude?: number;
  reason?: string;
  payload?: Record<string, unknown>;
}

export function geocodeCoordinatesAreUsable(value: Pick<ProviderGeocodeResult, "latitude" | "longitude">) {
  return typeof value.latitude === "number"
    && Number.isFinite(value.latitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && typeof value.longitude === "number"
    && Number.isFinite(value.longitude)
    && value.longitude >= -180
    && value.longitude <= 180;
}

export function geocodeCanMap(result?: ProviderGeocodeResult): result is ProviderGeocodeResult & { latitude: number; longitude: number } {
  return Boolean(result?.status === "accepted" && geocodeCoordinatesAreUsable(result));
}
