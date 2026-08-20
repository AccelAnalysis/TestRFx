import { NextRequest, NextResponse } from "next/server";
import {
  canonicalizeServiceGeographies,
  geocodeAddress,
  resolveAddressMismatch,
  resolveGeography,
} from "@/lib/onboarding/census-geography-service";
import { validateGeographyDraft, type GeographyContext } from "@/lib/onboarding/geography";

export const runtime = "nodejs";

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

    const geocode = await geocodeAddress(submitted.baseLocation);
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

    const context: GeographyContext = {
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
      services: {
        geography: "US Census TIGERweb",
        geocoder: "US Census Geocoder",
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
