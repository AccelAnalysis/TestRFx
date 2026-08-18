import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { filterExchangeRecords } from "@/lib/exchange/filter";
import { lensDefinitions } from "@/lib/exchange/lenses";

const lenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
  const lens = lensParam as ExchangeLens;
  const search = request.nextUrl.searchParams.get("q") ?? "";
  const records = filterExchangeRecords(exchangeSeed, lens, search);
  return NextResponse.json({ lens, records, actions: lensDefinitions[lens].actions(records[0]) });
}
