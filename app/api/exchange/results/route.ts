import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, MapBounds } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { deriveReferenceViewerContext } from "@/lib/exchange/action-registry";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { scopeMapRecordsToBounds } from "@/lib/exchange/map-service";
import { searchExchangeRecords, searchStateFromParams } from "@/lib/exchange/search";

const lenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);

function boundsFromRequest(request: NextRequest): MapBounds | undefined {
  const names = ["north", "south", "east", "west"] as const;
  const raw = Object.fromEntries(names.map((name) => [name, request.nextUrl.searchParams.get(name)])) as Record<(typeof names)[number], string | null>;
  if (names.some((name) => raw[name] === null || raw[name] === "")) return undefined;
  const values = Object.fromEntries(names.map((name) => [name, Number(raw[name])])) as Record<(typeof names)[number], number>;
  if (!names.every((name) => Number.isFinite(values[name]))) return undefined;
  if (values.north < values.south) return undefined;
  return values;
}

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
  const lens = lensParam as ExchangeLens;
  const state = searchStateFromParams(request.nextUrl.searchParams);
  const response = searchExchangeRecords(exchangeSeed, lens, state);
  const bounds = boundsFromRequest(request);
  const records = scopeMapRecordsToBounds(response.results.map((result) => result.record), bounds);
  const mapped = records.filter((record) => record.location).length;
  const viewer = deriveReferenceViewerContext(exchangeSeed);

  return NextResponse.json({
    lens,
    state,
    bounds,
    records,
    matches: response.results.filter((result) => records.some((record) => record.id === result.record.id)).map((result) => ({ id: result.record.id, ...result.match })),
    summary: { total: records.length, mapped, offMap: records.length - mapped },
    actions: lensDefinitions[lens].actions(viewer),
  });
}
