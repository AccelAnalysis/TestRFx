export type GeographyReleaseState = "released" | "visible" | "limited" | "restricted";
export type LocationVisibility = "exact" | "approximate" | "locality_only";
export type ServiceAreaMode = "localities" | "statewide" | "nationwide" | "remote";

export interface GeographyOption {
  id: string;
  name: string;
  stateCode: string;
  countryCode: "US";
  type: "county" | "independent_city";
  releaseState: GeographyReleaseState;
  primarySelectable: boolean;
  previewPosition: { x: number; y: number };
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

export interface GeographyDraft {
  primaryGeographyId: string;
  baseLocation: BaseLocationDraft;
  mapConfirmed: boolean;
  visibility: LocationVisibility;
  serviceMode: ServiceAreaMode;
  serviceGeographyIds: string[];
}

export interface GeographyContext {
  primaryGeography: GeographyOption;
  primaryLocation: BaseLocationDraft & {
    geocodeStatus: "reference_preview";
    mapConfirmed: true;
  };
  publicLocation: {
    visibility: LocationVisibility;
  };
  serviceArea: {
    mode: ServiceAreaMode;
    geographyIds: string[];
  };
  availabilityState: GeographyReleaseState;
  mapCamera: {
    source: "primary_geography";
    geographyId: string;
  };
}

export const geographyOptions: GeographyOption[] = [
  {
    id: "isle-of-wight-va",
    name: "Isle of Wight County",
    stateCode: "VA",
    countryCode: "US",
    type: "county",
    releaseState: "released",
    primarySelectable: true,
    previewPosition: { x: 48, y: 48 },
  },
  {
    id: "suffolk-va",
    name: "Suffolk",
    stateCode: "VA",
    countryCode: "US",
    type: "independent_city",
    releaseState: "visible",
    primarySelectable: false,
    previewPosition: { x: 67, y: 58 },
  },
  {
    id: "southampton-va",
    name: "Southampton County",
    stateCode: "VA",
    countryCode: "US",
    type: "county",
    releaseState: "visible",
    primarySelectable: false,
    previewPosition: { x: 39, y: 72 },
  },
  {
    id: "hampton-va",
    name: "Hampton",
    stateCode: "VA",
    countryCode: "US",
    type: "independent_city",
    releaseState: "visible",
    primarySelectable: false,
    previewPosition: { x: 72, y: 30 },
  },
  {
    id: "newport-news-va",
    name: "Newport News",
    stateCode: "VA",
    countryCode: "US",
    type: "independent_city",
    releaseState: "visible",
    primarySelectable: false,
    previewPosition: { x: 61, y: 26 },
  },
  {
    id: "norfolk-va",
    name: "Norfolk",
    stateCode: "VA",
    countryCode: "US",
    type: "independent_city",
    releaseState: "visible",
    primarySelectable: false,
    previewPosition: { x: 79, y: 52 },
  },
];

export function createInitialGeographyDraft(): GeographyDraft {
  return {
    primaryGeographyId: "",
    baseLocation: {
      address1: "",
      address2: "",
      city: "",
      state: "VA",
      postalCode: "",
      country: "US",
      homeBased: false,
    },
    mapConfirmed: false,
    visibility: "approximate",
    serviceMode: "localities",
    serviceGeographyIds: [],
  };
}

export function getGeographyOption(id: string) {
  return geographyOptions.find((geography) => geography.id === id);
}

export type GeographyValidationResult =
  | { ok: true; draft: GeographyDraft }
  | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateGeographyDraft(value: unknown): GeographyValidationResult {
  if (!isRecord(value)) return { ok: false, errors: ["A geography payload is required."] };

  const baseLocation = isRecord(value.baseLocation) ? value.baseLocation : {};
  const draft: GeographyDraft = {
    primaryGeographyId: typeof value.primaryGeographyId === "string" ? value.primaryGeographyId : "",
    baseLocation: {
      address1: typeof baseLocation.address1 === "string" ? baseLocation.address1.trim() : "",
      address2: typeof baseLocation.address2 === "string" ? baseLocation.address2.trim() : "",
      city: typeof baseLocation.city === "string" ? baseLocation.city.trim() : "",
      state: typeof baseLocation.state === "string" ? baseLocation.state.trim().toUpperCase() : "",
      postalCode: typeof baseLocation.postalCode === "string" ? baseLocation.postalCode.trim() : "",
      country: "US",
      homeBased: baseLocation.homeBased === true,
    },
    mapConfirmed: value.mapConfirmed === true,
    visibility:
      value.visibility === "exact" || value.visibility === "locality_only" ? value.visibility : "approximate",
    serviceMode:
      value.serviceMode === "statewide" || value.serviceMode === "nationwide" || value.serviceMode === "remote"
        ? value.serviceMode
        : "localities",
    serviceGeographyIds: Array.isArray(value.serviceGeographyIds)
      ? value.serviceGeographyIds.filter((item): item is string => typeof item === "string")
      : [],
  };

  const errors: string[] = [];
  const primary = getGeographyOption(draft.primaryGeographyId);

  if (!primary) errors.push("Select a recognized primary geography.");
  else if (!primary.primarySelectable || primary.releaseState !== "released") {
    errors.push(`${primary.name} is visible in this reference build but is not released for primary activation.`);
  }

  if (!draft.baseLocation.address1) errors.push("Enter the organization's base street address.");
  if (!draft.baseLocation.city) errors.push("Enter the organization's base city.");
  if (!draft.baseLocation.state) errors.push("Enter the organization's base state.");
  if (!draft.baseLocation.postalCode) errors.push("Enter the organization's postal code.");
  if (!draft.mapConfirmed) errors.push("Confirm the reference map placement before completing Geography.");

  if (draft.serviceMode === "localities" && draft.serviceGeographyIds.length === 0) {
    errors.push("Select at least one service geography or choose a broader service-area mode.");
  }

  const unknownServiceGeographies = draft.serviceGeographyIds.filter((id) => !getGeographyOption(id));
  if (unknownServiceGeographies.length) errors.push("One or more selected service geographies are not recognized.");

  return errors.length ? { ok: false, errors } : { ok: true, draft };
}

export function buildGeographyContext(draft: GeographyDraft): GeographyContext {
  const primaryGeography = getGeographyOption(draft.primaryGeographyId);
  if (!primaryGeography) throw new Error("Primary geography must be validated before context construction.");
  if (!draft.mapConfirmed) throw new Error("Map placement must be confirmed before context construction.");

  return {
    primaryGeography,
    primaryLocation: {
      ...draft.baseLocation,
      geocodeStatus: "reference_preview",
      mapConfirmed: true,
    },
    publicLocation: {
      visibility: draft.visibility,
    },
    serviceArea: {
      mode: draft.serviceMode,
      geographyIds: draft.serviceMode === "localities" ? draft.serviceGeographyIds : [],
    },
    availabilityState: primaryGeography.releaseState,
    mapCamera: {
      source: "primary_geography",
      geographyId: primaryGeography.id,
    },
  };
}
