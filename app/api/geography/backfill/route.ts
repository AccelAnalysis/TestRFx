import { NextRequest, NextResponse } from "next/server";
import { assertGeographyIngestionAccess } from "@/lib/server/geography/ingestion-auth";
import { backfillLocationGeographies } from "@/lib/server/geography/geography-repository";
import { GeographyIngestionError } from "@/lib/server/geography/boundary-ingestion-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    assertGeographyIngestionAccess(request);
    const payload = await request.json().catch(() => ({})) as { limit?: number; marketKey?: string };
    const result = await backfillLocationGeographies({ limit: payload.limit, marketKey: payload.marketKey?.trim() || undefined });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof GeographyIngestionError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geography backfill failed." }, { status: 500 });
  }
}
