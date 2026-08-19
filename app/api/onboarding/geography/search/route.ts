import { NextRequest, NextResponse } from "next/server";
import { resolveGeography, searchGeographies } from "@/lib/onboarding/census-geography-service";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  try {
    if (id) {
      const geography = await resolveGeography(id);
      if (!geography) return NextResponse.json({ error: "Geography not found." }, { status: 404 });
      return NextResponse.json({ geography, source: "US Census TIGERweb" });
    }

    if (query.length < 2) {
      return NextResponse.json({ error: "Enter at least two characters to search geography." }, { status: 400 });
    }

    const geographies = await searchGeographies(query);
    return NextResponse.json({ geographies, source: "US Census TIGERweb" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "The Census geography service is unavailable.",
      },
      { status: 502 },
    );
  }
}
