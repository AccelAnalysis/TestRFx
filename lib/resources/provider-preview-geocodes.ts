import type { ResourceProviderExchangeRecord } from "./provider-listing";
import geocodes from "../../data/seed-packs/hampton-roads-va/geocodes.json";

type AcceptedGeocode = {
  latitude: number;
  longitude: number;
};

type GeocodeManifest = {
  accepted: Record<string, AcceptedGeocode>;
};

const accepted = (geocodes as GeocodeManifest).accepted;

export function applyHamptonRoadsProviderPreviewGeocode(record: ResourceProviderExchangeRecord): ResourceProviderExchangeRecord {
  const seedKey = record.resourceProvider.source.sourceKey;
  const geocode = accepted[seedKey];
  if (!geocode || !Number.isFinite(geocode.latitude) || !Number.isFinite(geocode.longitude)) return record;

  return {
    ...record,
    location: { lat: geocode.latitude, lng: geocode.longitude },
    resource: record.resource ? { ...record.resource, visibility: "public-location" } : record.resource,
  };
}
