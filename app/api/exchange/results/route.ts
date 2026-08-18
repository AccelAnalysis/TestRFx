import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { searchExchangeRecords, searchStateFromParams } from "@/lib/exchange/search";

const lenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });

  const lens = lensParam as ExchangeLens;
  const state = searchStateFromParams(request.nextUrl.searchParams);
  const response = searchExchangeRecords(exchangeSeed, lens, state);
  const records = response.results.map((result) => result.record);

  return NextResponse.json({
    lens,
    state,
    records,
    matches: response.results.map((result) => ({ id: result.record.id, ...result.match })),
    summary: { total: response.total, mapped: response.mapped, offMap: response.offMap },
    actions: lensDefinitions[lens].actions(records[0]),
  });
}
