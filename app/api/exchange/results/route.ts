import { NextRequest, NextResponse } from "next/server";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { searchStateFromParams } from "@/lib/exchange/search";
import { searchExchangeRepository } from "@/lib/exchange/search-repository";
import { resolveSearchPrincipal, SearchAuthorizationError } from "@/lib/exchange/search-principal";
import { DatabaseUnavailableError } from "@/lib/server/postgres";

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!isExchangeLens(lensParam)) return NextResponse.json({ error: "Unsupported lens", code: "invalid_lens" }, { status: 400 });

  const state = searchStateFromParams(request.nextUrl.searchParams);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(Math.floor(requestedLimit), 100)) : 30;

  try {
    const principal = await resolveSearchPrincipal(request);
    const response = await searchExchangeRepository({ lens: lensParam, state, principal, cursor, limit });
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) {
      return NextResponse.json({ error: "Universal Search is unavailable until the RFxchange database is configured.", code: error.code }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    if (error instanceof SearchAuthorizationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    console.error("Universal Search query failed", error);
    return NextResponse.json({ error: "Universal Search could not complete this request.", code: "search_failed" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
