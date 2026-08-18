import { NextRequest, NextResponse } from "next/server";
import type { ExchangeSearchState } from "@/lib/exchange/contracts";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { normalizeSearchState } from "@/lib/exchange/search";
import { createSavedSearch, listSearchLibrary } from "@/lib/exchange/search-library-repository";
import { resolveSearchPrincipal, SearchAuthenticationRequiredError, SearchAuthorizationError } from "@/lib/exchange/search-principal";
import { DatabaseUnavailableError } from "@/lib/server/postgres";

function failure(error: unknown) {
  if (error instanceof SearchAuthenticationRequiredError) return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
  if (error instanceof SearchAuthorizationError) return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
  if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: "Search persistence is unavailable until the RFxchange database is configured.", code: error.code }, { status: 503 });
  console.error("Search library request failed", error);
  return NextResponse.json({ error: "Search library request failed.", code: "search_library_failed" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const lens = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!isExchangeLens(lens)) return NextResponse.json({ error: "Unsupported lens", code: "invalid_lens" }, { status: 400 });
  try {
    const principal = await resolveSearchPrincipal(request);
    const library = await listSearchLibrary(principal, lens);
    return NextResponse.json(library, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  let body: { name?: unknown; lens?: unknown; state?: unknown; alertEnabled?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid search payload.", code: "invalid_request" }, { status: 400 }); }
  if (typeof body.name !== "string" || typeof body.lens !== "string" || !isExchangeLens(body.lens)) {
    return NextResponse.json({ error: "Saved searches require a name and supported lens.", code: "invalid_request" }, { status: 400 });
  }
  try {
    const principal = await resolveSearchPrincipal(request);
    const saved = await createSavedSearch(principal, {
      name: body.name,
      lens: body.lens,
      state: normalizeSearchState(body.state) as ExchangeSearchState,
      alertEnabled: body.alertEnabled === true,
    });
    return NextResponse.json(saved, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
