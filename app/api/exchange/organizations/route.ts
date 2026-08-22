import { NextRequest, NextResponse } from "next/server";
import { DatabaseServiceUnavailableError, getDatabase } from "@/lib/server/database";
import { ExchangeUnauthorizedError, resolveExchangeActor } from "@/lib/server/exchange/actor";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const query = request.nextUrl.searchParams.get("q")?.trim().slice(0, 100) ?? "";
    if (query.length < 2) return NextResponse.json({ organizations: [] });
    const sql = getDatabase();
    const organizations = await sql<{ id: string; name: string }[]>`
      SELECT id::text, name
      FROM organizations
      WHERE id <> ${actor.organizationId}::uuid
        AND name ILIKE ${`%${query}%`}
      ORDER BY CASE WHEN lower(name) = lower(${query}) THEN 0 ELSE 1 END, name
      LIMIT 12
    `;
    return NextResponse.json({ organizations });
  } catch (error) {
    if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof DatabaseServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Organization search failed." }, { status: 500 });
  }
}
