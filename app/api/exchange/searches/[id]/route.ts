import { NextRequest, NextResponse } from "next/server";
import { normalizeSearchState } from "@/lib/exchange/search";
import { deleteSavedSearch, updateSavedSearch } from "@/lib/exchange/search-library-repository";
import { resolveSearchPrincipal, SearchAuthenticationRequiredError, SearchAuthorizationError } from "@/lib/exchange/search-principal";
import { DatabaseUnavailableError } from "@/lib/server/postgres";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(error: unknown) {
  if (error instanceof SearchAuthenticationRequiredError) return NextResponse.json({ error: error.message, code: error.code }, { status: 401 });
  if (error instanceof SearchAuthorizationError) return NextResponse.json({ error: error.message, code: error.code }, { status: 403 });
  if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: "Search persistence is unavailable until the RFxchange database is configured.", code: error.code }, { status: 503 });
  console.error("Saved search request failed", error);
  return NextResponse.json({ error: "Saved search request failed.", code: "saved_search_failed" }, { status: 500 });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid saved search identifier.", code: "invalid_request" }, { status: 400 });
  let body: { name?: unknown; state?: unknown; alertEnabled?: unknown };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "Invalid saved search payload.", code: "invalid_request" }, { status: 400 }); }
  const patch: { name?: string; state?: ReturnType<typeof normalizeSearchState>; alertEnabled?: boolean } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string") return NextResponse.json({ error: "Saved search name must be text.", code: "invalid_request" }, { status: 400 });
    patch.name = body.name;
  }
  if (body.state !== undefined) patch.state = normalizeSearchState(body.state);
  if (body.alertEnabled !== undefined) {
    if (typeof body.alertEnabled !== "boolean") return NextResponse.json({ error: "Alert setting must be true or false.", code: "invalid_request" }, { status: 400 });
    patch.alertEnabled = body.alertEnabled;
  }
  try {
    const principal = await resolveSearchPrincipal(request);
    const saved = await updateSavedSearch(principal, id, patch);
    if (!saved) return NextResponse.json({ error: "Saved search not found.", code: "not_found" }, { status: 404 });
    return NextResponse.json(saved, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!uuidPattern.test(id)) return NextResponse.json({ error: "Invalid saved search identifier.", code: "invalid_request" }, { status: 400 });
  try {
    const principal = await resolveSearchPrincipal(request);
    const deleted = await deleteSavedSearch(principal, id);
    if (!deleted) return NextResponse.json({ error: "Saved search not found.", code: "not_found" }, { status: 404 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
