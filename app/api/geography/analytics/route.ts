import { NextRequest, NextResponse } from "next/server";
import { resolveOnboardingActor, OnboardingUnauthorizedError } from "@/lib/server/onboarding/actor";
import { geographyAnalytics } from "@/lib/server/geography/analytics";
import { coreGeographyLevels, parallelGeographyTypes, type PlatformGeographyType } from "@/lib/geography/contracts";
import type { ExchangeRecordType } from "@/lib/exchange/contracts";

export const dynamic = "force-dynamic";

const geographyTypes = new Set<PlatformGeographyType>([...coreGeographyLevels, ...parallelGeographyTypes]);
const recordTypes = new Set<ExchangeRecordType>(["rfx", "resource", "intelligence", "capability"]);

export async function GET(request: NextRequest) {
  try {
    await resolveOnboardingActor(request);
    const requestedType = request.nextUrl.searchParams.get("type")?.trim() as PlatformGeographyType | undefined;
    const requestedRecordType = request.nextUrl.searchParams.get("recordType")?.trim() as ExchangeRecordType | undefined;
    if (requestedType && !geographyTypes.has(requestedType)) return NextResponse.json({ error: "Unsupported geography type." }, { status: 400 });
    if (requestedRecordType && !recordTypes.has(requestedRecordType)) return NextResponse.json({ error: "Unsupported Exchange record type." }, { status: 400 });
    const rows = await geographyAnalytics({
      geographyType: requestedType,
      recordType: requestedRecordType,
      economicDevelopmentOnly: request.nextUrl.searchParams.get("economic") === "1",
      includeOrganizations: request.nextUrl.searchParams.get("organizations") === "1",
    });
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OnboardingUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geography analytics are unavailable." }, { status: 503 });
  }
}
