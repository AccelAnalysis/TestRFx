import { NextRequest, NextResponse } from "next/server";
import { isExchangeLens } from "@/lib/exchange/lenses";
import { normalizeSearchState } from "@/lib/exchange/search";
import { recordRecentSearch } from "@/lib/exchange/search-library-repository";
import { resolveSearchPrincipal, SearchAuthenticationRequiredError, SearchAuthorizationError } from "@/lib/exchange/search-principal";
import { DatabaseUnavailableError } from "@/lib/server/postgres";

export async function POST(request: NextRequest) {
  let body: { lens?: unknown; state?: unknown; resultCount?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid recent search payload.", code: "invalid_request" }, { status: 400 }); }
  if (typeof body.lens !== "string" || !isExchangeLens(body.lens)) return NextResponse.json({ error: "Unsupported lens.", code: "invalid_lens" }, { status: 400 });
  const resultCount = typeof body.resultCount === "number" && Number.isFinite(body.resultCount) ? body.resultCount : 0;
  try {
    const principal = await resolveSearchPrincipal(request);
    await recordRecentSearch(principal, { lens: body.lens, state: normalizeSearchState(body.state), resultCount });
    return NextResponse.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SearchAuthenticationRequiredError) return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
    if (error instanceof SearchAuthorizationError) return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: "Search activity persistence is unavailable until the RFxchange database is configured.", code: error.code }, { status: 503 });
    console.error("Recent search persistence failed", error);
    return NextResponse.json({ error: "Recent search persistence failed.", code: "recent_search_failed" }, { status: 500 });
  }
}
