import { NextRequest, NextResponse } from "next/server";
import { ingestGeographyBoundaries, GeographyIngestionError, type GeographyBoundarySource } from "@/lib/server/geography/boundary-ingestion-service";
import { assertGeographyIngestionAccess } from "@/lib/server/geography/ingestion-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertGeographyIngestionAccess(request);
    const payload = await request.json() as { source?: GeographyBoundarySource; features?: unknown[] };
    if (!payload.source || !Array.isArray(payload.features)) {
      return NextResponse.json({ error: "source and features are required." }, { status: 400 });
    }
    const result = await ingestGeographyBoundaries({ source: payload.source, features: payload.features });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GeographyIngestionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error("Geography boundary ingestion failed", error);
    return NextResponse.json({ error: "Geography boundary ingestion failed." }, { status: 500 });
  }
}
