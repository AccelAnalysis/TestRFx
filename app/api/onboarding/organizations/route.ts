import { NextRequest, NextResponse } from "next/server";
import { normalizeDomain, searchOrganizations } from "@/lib/onboarding/organization";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const domain = normalizeDomain(request.nextUrl.searchParams.get("domain") ?? "");

  if (query.length > 120 || domain.length > 120) {
    return NextResponse.json({ error: "Search input is too long." }, { status: 400 });
  }

  const organizations = searchOrganizations({ query, domain });

  return NextResponse.json({
    organizations,
    referenceOnly: true,
    integration: "Replace the reference search with canonical organization/entity-resolution services without changing the onboarding UI contract.",
  });
}
