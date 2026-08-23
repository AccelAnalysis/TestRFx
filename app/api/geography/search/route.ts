import { NextRequest, NextResponse } from "next/server";
import { resolveOnboardingActor, OnboardingUnauthorizedError } from "@/lib/server/onboarding/actor";
import { searchCanonicalGeographies } from "@/lib/server/geography/catalog";
import { coreGeographyLevels, parallelGeographyTypes, type PlatformGeographyType } from "@/lib/geography/contracts";

export const dynamic = "force-dynamic";

const geographyTypes = new Set<PlatformGeographyType>([...coreGeographyLevels, ...parallelGeographyTypes]);

export async function GET(request: NextRequest) {
  try {
    await resolveOnboardingActor(request);
    const requestedType = request.nextUrl.searchParams.get("type")?.trim() as PlatformGeographyType | undefined;
    if (requestedType && !geographyTypes.has(requestedType)) return NextResponse.json({ error: "Unsupported geography type." }, { status: 400 });
    const rows = await searchCanonicalGeographies({
      query: request.nextUrl.searchParams.get("q") ?? undefined,
      type: requestedType,
      stateCode: request.nextUrl.searchParams.get("state") ?? undefined,
      economicDevelopmentOnly: request.nextUrl.searchParams.get("economic") === "1",
      limit: Number(request.nextUrl.searchParams.get("limit") ?? 30),
    });
    return NextResponse.json({ geographies: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OnboardingUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geography catalog is unavailable." }, { status: 503 });
  }
}
