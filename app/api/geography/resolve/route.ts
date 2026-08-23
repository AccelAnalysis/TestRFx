import { NextRequest, NextResponse } from "next/server";
import { resolveCensusAddressProfile, resolveCensusCoordinateProfile } from "@/lib/server/geography/census-profile-resolver";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 300) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    if (payload.address && typeof payload.address === "object") {
      const address = payload.address as Record<string, unknown>;
      const address1 = clean(address.address1 ?? address.street);
      const city = clean(address.city, 120);
      const state = clean(address.state, 2).toUpperCase();
      if (!address1 || !city || !state) return NextResponse.json({ error: "address1, city, and state are required." }, { status: 400 });
      const resolved = await resolveCensusAddressProfile({
        address1,
        address2: clean(address.address2, 120) || undefined,
        city,
        state,
        postalCode: clean(address.postalCode ?? address.zip, 12) || undefined,
      });
      return NextResponse.json(resolved, { headers: { "Cache-Control": "no-store" } });
    }
    const latitude = Number(payload.latitude);
    const longitude = Number(payload.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: "Provide an address or finite latitude/longitude." }, { status: 400 });
    }
    const profile = await resolveCensusCoordinateProfile({ latitude, longitude });
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geography resolution failed." }, { status: 502 });
  }
}
