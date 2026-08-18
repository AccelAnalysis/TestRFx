export type GeographyReleaseState = "released" | "visible" | "limited" | "restricted";
export type LocationVisibility = "exact" | "approximate" | "locality_only";
export type ServiceAreaMode = "localities" | "statewide" | "nationwide" | "remote";
export type GeographyType = "county" | "independent_city" | "incorporated_place" | "census_designated_place";
export type GeographyStage = "primary-locality" | "base-location" | "map-placement" | "privacy" | "service-geography" | "review";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeographyBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GeographyOption {
  id: string;
  geoid: string;
  name: string;
  stateCode: string;
  countryCode: "US";
  type: GeographyType;
  releaseState: GeographyReleaseState;
  primarySelectable: boolean;
  centroid?: Coordinates;
  bounds?: GeographyBounds;
  source: "census_tigerweb";
}

export interface BaseLocationDraft {
  address1: string;
  address2: string;
  city: string;
  state: string;
  postalCode: string;
  country: "US";
  homeBased: boolean;
}

export interface GeocodeMatch {
  matchedAddress: string;
  coordinates: Coordinates;
  county?: {
    geoid: string;
    name: string;
    stateCode: string;
  };
  place?: {
    geoid: string;
    name: string;
    stateCode: string;
  };
  source: "census_geocoder";
}

export type GeographyMismatchResolution = "use_detected" | "keep_selected";

export interface GeographyMismatch {
  status: "match" | "mismatch" | "unresolved";
  detectedGeography?: GeographyOption;
  resolution?: GeographyMismatchResolution;
  explanation?: string;
}

export interface GeographyDraft {
  primaryGeography: GeographyOption | null;
  baseLocation: BaseLocationDraft;
  geocode: GeocodeMatch | null;
  mismatch: GeographyMismatch | null;
  mapConfirmed: boolean;
  visibility: LocationVisibility;
  serviceMode: ServiceAreaMode;
  serviceGeographies: GeographyOption[];
}

export interface GeographyContext {
  primaryGeography: GeographyOption;
  primaryLocation: BaseLocationDraft & {
    geocodeStatus: "matched";
    matchedAddress: string;
    coordinates: Coordinates;
    mapConfirmed: true;
  };
  publicLocation: {
    visibility: LocationVisibility;
    coordinates: Coordinates | null;
  };
  serviceArea: {
    mode: ServiceAreaMode;
    geographies: GeographyOption[];
  };
  availabilityState: GeographyReleaseState;
  mapCamera: {
    source: "primary_geography" | "confirmed_location";
    center: Coordinates;
    bounds?: GeographyBounds;
  };
  source: {
    geography: "US Census TIGERweb";
    geocoder: "US Census Geocoder";
  };
}

export interface GeographyNavLeaf {
  id: string;
  label: string;
  href: string;
  conditional?: "mismatch" | "localities";
}

export interface GeographyNavNode {
  id: GeographyStage;
  label: string;
  href: string;
  children: GeographyNavLeaf[];
}

export const geographyNavigation: GeographyNavNode[] = [
  {
    id: "primary-locality",
    label: "Primary locality",
    href: "/onboarding/geography/primary-locality/search",
    children: [
      { id: "search", label: "Search locality", href: "/onboarding/geography/primary-locality/search" },
      { id: "availability", label: "Availability & boundary", href: "/onboarding/geography/primary-locality/availability" },
    ],
  },
  {
    id: "base-location",
    label: "Base location",
    href: "/onboarding/geography/base-location/address",
    children: [
      { id: "address", label: "Physical address", href: "/onboarding/geography/base-location/address" },
      { id: "geocode", label: "Geocode & normalize", href: "/onboarding/geography/base-location/geocode" },
      { id: "mismatch", label: "Resolve locality mismatch", href: "/onboarding/geography/base-location/mismatch", conditional: "mismatch" },
    ],
  },
  {
    id: "map-placement",
    label: "Map placement",
    href: "/onboarding/geography/map-placement/confirm",
    children: [
      { id: "confirm", label: "Confirm marker", href: "/onboarding/geography/map-placement/confirm" },
    ],
  },
  {
    id: "privacy",
    label: "Location privacy",
    href: "/onboarding/geography/privacy/visibility",
    children: [
      { id: "visibility", label: "Visibility preference", href: "/onboarding/geography/privacy/visibility" },
    ],
  },
  {
    id: "service-geography",
    label: "Service geography",
    href: "/onboarding/geography/service-geography/coverage",
    children: [
      { id: "coverage", label: "Coverage mode", href: "/onboarding/geography/service-geography/coverage" },
      { id: "localities", label: "Select service localities", href: "/onboarding/geography/service-geography/localities", conditional: "localities" },
    ],
  },
  {
    id: "review",
    label: "Review & completion",
    href: "/onboarding/geography/review/summary",
    children: [
      { id: "summary", label: "Review geography", href: "/onboarding/geography/review/summary" },
      { id: "complete", label: "Complete & hand off", href: "/onboarding/geography/review/complete" },
    ],
  },
];

export const geographyRouteParams = geographyNavigation.flatMap((node) =>
  node.children.map((child) => ({ stage: node.id, task: [child.id] })),
);

export function createInitialGeographyDraft(): GeographyDraft {
  return {
    primaryGeography: null,
    baseLocation: {
      address1: "",
      address2: "",
      city: "",
      state: "VA",
      postalCode: "",
      country: "US",
      homeBased: false,
    },
    geocode: null,
    mismatch: null,
    mapConfirmed: false,
    visibility: "approximate",
    serviceMode: "localities",
    serviceGeographies: [],
  };
}

export function geographyNode(stage: string) {
  return geographyNavigation.find((node) => node.id === stage);
}

export function geographyLeaf(stage: string, task: string) {
  return geographyNode(stage)?.children.find((child) => child.id === task);
}

export function isGeographyRoute(stage: string, task: string) {
  return Boolean(geographyLeaf(stage, task));
}

export type GeographyValidationResult =
  | { ok: true; draft: GeographyDraft }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, maxLength = 240) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseGeographyOption(value: unknown): GeographyOption | null {
  if (!isRecord(value)) return null;
  const id = clean(value.id, 80);
  const geoid = clean(value.geoid, 20);
  const name = clean(value.name, 180);
  const stateCode = clean(value.stateCode, 2).toUpperCase();
  const type = clean(value.type, 40) as GeographyType;
  const supportedTypes = new Set<GeographyType>(["county", "independent_city", "incorporated_place", "census_designated_place"]);
  if (!id || !geoid || !name || stateCode.length !== 2 || !supportedTypes.has(type)) return null;
  return {
    id,
    geoid,
    name,
    stateCode,
    countryCode: "US",
    type,
    releaseState:
      value.releaseState === "released" || value.releaseState === "limited" || value.releaseState === "restricted"
        ? value.releaseState
        : "visible",
    primarySelectable: value.primarySelectable === true,
    source: "census_tigerweb",
  };
}

function parseGeocode(value: unknown): GeocodeMatch | null {
  if (!isRecord(value) || !isRecord(value.coordinates)) return null;
  const latitude = Number(value.coordinates.latitude);
  const longitude = Number(value.coordinates.longitude);
  const matchedAddress = clean(value.matchedAddress, 300);
  if (!matchedAddress || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const county = isRecord(value.county)
    ? { geoid: clean(value.county.geoid, 20), name: clean(value.county.name, 180), stateCode: clean(value.county.stateCode, 2) }
    : undefined;
  const place = isRecord(value.place)
    ? { geoid: clean(value.place.geoid, 20), name: clean(value.place.name, 180), stateCode: clean(value.place.stateCode, 2) }
    : undefined;
  return {
    matchedAddress,
    coordinates: { latitude, longitude },
    ...(county?.geoid && county.name ? { county } : {}),
    ...(place?.geoid && place.name ? { place } : {}),
    source: "census_geocoder",
  };
}

export function validateGeographyDraft(value: unknown): GeographyValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ["A geography payload is required."] };

  const baseLocation = isRecord(value.baseLocation) ? value.baseLocation : {};
  const primaryGeography = parseGeographyOption(value.primaryGeography);
  const geocode = parseGeocode(value.geocode);
  const serviceGeographies = Array.isArray(value.serviceGeographies)
    ? value.serviceGeographies.map(parseGeographyOption).filter((item): item is GeographyOption => Boolean(item))
    : [];

  const draft: GeographyDraft = {
    primaryGeography,
    baseLocation: {
      address1: clean(baseLocation.address1, 220),
      address2: clean(baseLocation.address2, 220),
      city: clean(baseLocation.city, 120),
      state: clean(baseLocation.state, 2).toUpperCase(),
      postalCode: clean(baseLocation.postalCode, 32),
      country: "US",
      homeBased: baseLocation.homeBased === true,
    },
    geocode,
    mismatch: isRecord(value.mismatch)
      ? {
          status: value.mismatch.status === "match" || value.mismatch.status === "mismatch" ? value.mismatch.status : "unresolved",
          detectedGeography: parseGeographyOption(value.mismatch.detectedGeography) ?? undefined,
          resolution:
            value.mismatch.resolution === "use_detected" || value.mismatch.resolution === "keep_selected"
              ? value.mismatch.resolution
              : undefined,
          explanation: clean(value.mismatch.explanation, 600) || undefined,
        }
      : null,
    mapConfirmed: value.mapConfirmed === true,
    visibility:
      value.visibility === "exact" || value.visibility === "locality_only" ? value.visibility : "approximate",
    serviceMode:
      value.serviceMode === "statewide" || value.serviceMode === "nationwide" || value.serviceMode === "remote"
        ? value.serviceMode
        : "localities",
    serviceGeographies,
  };

  const errors: string[] = [];
  if (!draft.primaryGeography) errors.push("Select a primary geography from the Census-backed locality search.");
  if (!draft.baseLocation.address1) errors.push("Enter the organization's base street address.");
  if (!draft.baseLocation.city) errors.push("Enter the organization's base city.");
  if (!draft.baseLocation.state) errors.push("Enter the organization's base state.");
  if (!draft.baseLocation.postalCode) errors.push("Enter the organization's postal code.");
  if (!draft.geocode) errors.push("Geocode and normalize the base address before completing Geography.");
  if (!draft.mapConfirmed) errors.push("Confirm the geocoded map placement before completing Geography.");
  if (draft.mismatch?.status === "mismatch" && !draft.mismatch.resolution) errors.push("Resolve the locality mismatch before completing Geography.");
  if (draft.mismatch?.resolution === "keep_selected" && !draft.mismatch.explanation) {
    errors.push("Explain why the selected primary geography differs from the geocoded address.");
  }
  if (draft.serviceMode === "localities" && draft.serviceGeographies.length === 0) {
    errors.push("Select at least one service geography or choose a broader service-area mode.");
  }

  return errors.length ? { ok: false, errors } : { ok: true, draft };
}

export function buildOsmEmbedUrl(coordinates: Coordinates) {
  const latitudeSpan = 0.025;
  const longitudeSpan = 0.035;
  const bbox = [
    coordinates.longitude - longitudeSpan,
    coordinates.latitude - latitudeSpan,
    coordinates.longitude + longitudeSpan,
    coordinates.latitude + latitudeSpan,
  ].join(",");
  const params = new URLSearchParams({
    bbox,
    layer: "mapnik",
    marker: `${coordinates.latitude},${coordinates.longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}
