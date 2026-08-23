import { NextRequest, NextResponse } from "next/server";
import {
  canonicalizeServiceGeographies,
  resolveAddressMismatch,
  resolveGeography,
} from "@/lib/onboarding/census-geography-service";
import { validateGeographyDraft, type GeocodeMatch, type GeographyContext } from "@/lib/onboarding/geography";
import type { GeographyProfile } from "@/lib/geography/contracts";
import { resolveCensusAddressProfile } from "@/lib/server/geography/census-profile-resolver";
import { persistOrganizationGeography } from "@/lib/server/geography/organization-geography-service";
import { ONBOARDING_SESSION_COOKIE, verifyOnboardingSessionToken } from "@/lib/identity/onboarding-session";
import { getOrganizationState } from "@/lib/onboarding/organization-repository";

export const runtime = "nodejs";

function legacyGeocode(resolved: Awaited<ReturnType<typeof resolveCensusAddressProfile>>): GeocodeMatch {
  const county = resolved.profile.hierarchy.countyEquivalent;
  const place = resolved.profile.hierarchy.place;
  return {
    matchedAddress: resolved.matchedAddress,
    coordinates: resolved.coordinates,
    ...(county?.geoid ? { county: { geoid: county.geoid, name: county.name, stateCode: county.stateCode ?? "" } } : {}),
    ...(place?.geoid ? { place: { geoid: place.geoid, name: place.name, stateCode: place.stateCode ?? "" } } : {}),
    source: "census_geocoder",
  };
}

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: ["A valid JSON geography payload is required."] }, { status: 400 });
  }

  const validation = validateGeographyDraft(payload);
  if (!validation.ok) return NextResponse.json({ errors: validation.errors }, { status: 422 });

  try {
    const submitted = validation.draft;
    if (!submitted.primaryGeography) {
      return NextResponse.json({ errors: ["Select a primary geography before completion."] }, { status: 422 });
    }

    let primaryGeography = await resolveGeography(submitted.primaryGeography.id);
    if (!primaryGeography) {
      return NextResponse.json({ errors: ["The selected primary geography could not be resolved by Census TIGERweb."] }, { status: 422 });
    }

    const resolvedAddress = await resolveCensusAddressProfile({
      address1: submitted.baseLocation.address1,
      address2: submitted.baseLocation.address2 || undefined,
      city: submitted.baseLocation.city,
      state: submitted.baseLocation.state,
      postalCode: submitted.baseLocation.postalCode || undefined,
    });
    const geocode = legacyGeocode(resolvedAddress);
    const freshMismatch = await resolveAddressMismatch(primaryGeography, geocode);

    if (freshMismatch.status === "mismatch") {
      if (submitted.mismatch?.resolution === "use_detected") {
        if (!freshMismatch.detectedGeography) {
          return NextResponse.json({ errors: ["The address locality could not be resolved as a selectable geography."] }, { status: 422 });
        }
        primaryGeography = freshMismatch.detectedGeography;
      } else if (submitted.mismatch?.resolution !== "keep_selected") {
        return NextResponse.json({ errors: ["Resolve the locality mismatch before completing Geography."] }, { status: 422 });
      }
    }

    if (!primaryGeography.primarySelectable || primaryGeography.releaseState !== "released") {
      return NextResponse.json(
        { errors: [`${primaryGeography.name}, ${primaryGeography.stateCode} is not released for primary RFxchange activation.`] },
        { status: 422 },
      );
    }

    const serviceGeographies = await canonicalizeServiceGeographies(submitted);
    if (submitted.serviceMode === "localities" && serviceGeographies.length === 0) {
      return NextResponse.json({ errors: ["At least one service locality must resolve successfully."] }, { status: 422 });
    }

    let profile: GeographyProfile = resolvedAddress.profile;
    let persistence: "postgres" | "context-only" = "context-only";
    const session = verifyOnboardingSessionToken(request.cookies.get(ONBOARDING_SESSION_COOKIE)?.value);
    if (session) {
      const organization = await getOrganizationState(session);
      if (!organization || organization.status !== "connected" || !organization.organizationId) {
        return NextResponse.json({ errors: ["Connect an organization before completing Geography."] }, { status: 409 });
      }
      const persisted = await persistOrganizationGeography({
        organizationId: organization.organizationId,
        address: submitted.baseLocation,
        matchedAddress: resolvedAddress.matchedAddress,
        latitude: resolvedAddress.coordinates.latitude,
        longitude: resolvedAddress.coordinates.longitude,
        visibility: submitted.visibility,
        homeBased: submitted.baseLocation.homeBased,
        profile,
        primaryGeography,
        serviceMode: submitted.serviceMode,
        serviceGeographies,
      });
      profile = persisted.geographyProfile;
      persistence = "postgres";
    }

    const context: GeographyContext & { geographyProfile: GeographyProfile } = {
      primaryGeography,
      primaryLocation: {
        ...submitted.baseLocation,
        geocodeStatus: "matched",
        matchedAddress: geocode.matchedAddress,
        coordinates: geocode.coordinates,
        mapConfirmed: true,
      },
      publicLocation: {
        visibility: submitted.visibility,
        coordinates:
          submitted.visibility === "exact"
            ? geocode.coordinates
            : submitted.visibility === "approximate"
              ? primaryGeography.centroid ?? null
              : null,
      },
      serviceArea: {
        mode: submitted.serviceMode,
        geographies: submitted.serviceMode === "localities" ? serviceGeographies : [],
      },
      geographyProfile: profile,
      availabilityState: primaryGeography.releaseState,
      mapCamera: {
        source: "confirmed_location",
        center: geocode.coordinates,
        ...(primaryGeography.bounds ? { bounds: primaryGeography.bounds } : {}),
      },
      source: {
        geography: "US Census TIGERweb",
        geocoder: "US Census Geocoder",
      },
    };

    return NextResponse.json({
      context,
      validated: true,
      persistence,
      services: {
        geography: "US Census TIGERweb",
        geocoder: "US Census Geocoder",
        profile: "US Census Geocoder geoLookup",
        map: "OpenStreetMap",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { errors: [error instanceof Error ? error.message : "Geography validation services are unavailable."] },
      { status: 502 },
    );
  }
}
