import { NextRequest, NextResponse } from "next/server";
import {
  geocodeAddress,
  resolveAddressMismatch,
  resolveGeography,
} from "@/lib/onboarding/census-geography-service";
import type { BaseLocationDraft } from "@/lib/onboarding/geography";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseAddress(value: unknown): BaseLocationDraft | null {
  if (!isRecord(value)) return null;
  const address: BaseLocationDraft = {
    address1: clean(value.address1, 220),
    address2: clean(value.address2, 220),
    city: clean(value.city, 120),
    state: clean(value.state, 2).toUpperCase(),
    postalCode: clean(value.postalCode, 32),
    country: "US",
    homeBased: value.homeBased === true,
  };
  return address.address1 && address.city && address.state && address.postalCode ? address : null;
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid JSON geocoding payload is required." }, { status: 400 });
  }

  if (!isRecord(payload)) return NextResponse.json({ error: "A geocoding payload is required." }, { status: 400 });
  const address = parseAddress(payload.address);
  if (!address) {
    return NextResponse.json(
      { error: "Street address, city, two-letter state, and ZIP code are required before geocoding." },
      { status: 422 },
    );
  }

  const primaryGeographyId = clean(payload.primaryGeographyId, 80);

  try {
    const match = await geocodeAddress(address);
    const primaryGeography = primaryGeographyId ? await resolveGeography(primaryGeographyId) : null;
    const mismatch = primaryGeography ? await resolveAddressMismatch(primaryGeography, match) : null;

    return NextResponse.json({
      match,
      primaryGeography,
      mismatch,
      source: "US Census Geocoder",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The Census Geocoder is unavailable." },
      { status: 422 },
    );
  }
}
