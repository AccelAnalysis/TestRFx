import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { searchExchangeRecords, searchStateFromParams } from "@/lib/exchange/search";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError } from "@/lib/server/database";
import { listExchangeRecords } from "@/lib/server/exchange-record-repository";

const lenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
    if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
    const lens = lensParam as ExchangeLens;
    const state = searchStateFromParams(request.nextUrl.searchParams);
    const actor = await resolveExchangeActor(request);
    const repositoryRecords = await listExchangeRecords({ lens, query: state.query, limit: 1000 }, actor);
    const response = searchExchangeRecords(repositoryRecords, lens, state);
    const records = response.results.map((result) => result.record);
    return NextResponse.json({
      lens,
      state,
      records,
      matches: response.results.map((result) => ({ id: result.record.id, ...result.match })),
      summary: { total: response.total, mapped: response.mapped, offMap: response.offMap },
      actions: lensDefinitions[lens].actions(records[0]),
      authenticated: Boolean(actor),
    });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message, state: "unavailable" }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Exchange results." }, { status: 500 });
  }
}
