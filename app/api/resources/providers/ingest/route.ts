import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { assertProviderIngestionAccess } from "@/lib/server/resources/ingestion-auth";
import { ProviderIngestionError, promoteProviderCandidate, stageProviderCandidates } from "@/lib/server/resources/provider-ingestion-service";
import type { ExternalSourceDescriptor, ProviderSourceCandidate } from "@/lib/resources/provider-ingestion";

export const dynamic = "force-dynamic";

type StageBody = { action: "stage"; source: ExternalSourceDescriptor; marketKey: string; candidates: ProviderSourceCandidate[] };
type PromoteBody = { action: "promote"; candidateId: string; canonicalOrganizationId?: string };

function errorResponse(error: unknown) {
  if (error instanceof ProviderIngestionError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { "Cache-Control": "no-store" } });
  }
  if (error instanceof DatabaseServiceUnavailableError) {
    return NextResponse.json({ error: error.message, code: "database_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  console.error("Resource Provider ingestion failed", error);
  return NextResponse.json({ error: "Resource Provider ingestion could not complete.", code: "ingestion_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  try {
    assertProviderIngestionAccess(request);
    const body = await request.json() as StageBody | PromoteBody;
    if (body.action === "stage") {
      if (!body.source || typeof body.marketKey !== "string" || !Array.isArray(body.candidates)) {
        throw new ProviderIngestionError("Stage requests require source, marketKey, and candidates.");
      }
      const result = await stageProviderCandidates(body);
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    if (body.action === "promote") {
      if (typeof body.candidateId !== "string" || !body.candidateId.trim()) {
        throw new ProviderIngestionError("Promotion requires candidateId.");
      }
      const result = await promoteProviderCandidate({ candidateId: body.candidateId, canonicalOrganizationId: body.canonicalOrganizationId });
      return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
    }
    throw new ProviderIngestionError("Unsupported Resource Provider ingestion action.");
  } catch (error) {
    return errorResponse(error);
  }
}
