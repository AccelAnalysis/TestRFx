import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { assertProviderIngestionAccess } from "@/lib/server/resources/ingestion-auth";
import { ProviderIngestionError } from "@/lib/server/resources/provider-ingestion-service";
import { acceptProviderGeocode, geocodeProviderCandidate } from "@/lib/server/resources/provider-geocoding-service";

export const dynamic = "force-dynamic";

type GeocodeBody = { action: "geocode"; marketKey: string; sourceKey: string; sourceRecordId: string };
type AcceptBody = {
  action: "accept";
  candidateId: string;
  latitude: number;
  longitude: number;
  matchedAddress?: string;
  basis: string;
};

function errorResponse(error: unknown) {
  if (error instanceof ProviderIngestionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof DatabaseServiceUnavailableError) {
    return NextResponse.json({ error: error.message, code: "database_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  console.error("Resource Provider geocoding failed", error);
  return NextResponse.json({ error: "Resource Provider geocoding could not complete.", code: "geocoding_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    assertProviderIngestionAccess(request);
    const body = await request.json() as GeocodeBody | AcceptBody;
    if (body.action === "geocode") {
      if (!body.marketKey?.trim() || !body.sourceKey?.trim() || !body.sourceRecordId?.trim()) {
        throw new ProviderIngestionError("Geocode requests require marketKey, sourceKey, and sourceRecordId.");
      }
      const result = await geocodeProviderCandidate({
        marketKey: body.marketKey,
        sourceKey: body.sourceKey,
        sourceRecordId: body.sourceRecordId,
      });
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "accept") {
      if (!body.candidateId?.trim() || typeof body.latitude !== "number" || typeof body.longitude !== "number" || !body.basis?.trim()) {
        throw new ProviderIngestionError("Manual acceptance requires candidateId, latitude, longitude, and basis.");
      }
      const result = await acceptProviderGeocode(body);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }
    throw new ProviderIngestionError("Unsupported Resource Provider geocoding action.");
  } catch (error) {
    return errorResponse(error);
  }
}
