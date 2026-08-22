import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens, ExchangeRecord, MapBounds } from "@/lib/exchange/contracts";
import { exchangeSeed } from "@/lib/exchange/seed";
import { deriveReferenceViewerContext } from "@/lib/exchange/action-registry";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { scopeMapRecordsToBounds } from "@/lib/exchange/map-service";
import { searchExchangeRecords, searchStateFromParams } from "@/lib/exchange/search";
import { DatabaseServiceUnavailableError } from "@/lib/server/database";
import { listSeededResourceProviderRecords } from "@/lib/server/resources/provider-ingestion-service";

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

async function recordsForLens(lens: ExchangeLens) {
  if (lens !== "resources") return { records: exchangeSeed, catalogMode: "reference" as const };
  try {
    const seeded = await listSeededResourceProviderRecords();
    const existingIds = new Set(exchangeSeed.map((record) => record.id));
    const merged: ExchangeRecord[] = [...exchangeSeed, ...seeded.filter((record) => !existingIds.has(record.id))];
    return { records: merged, catalogMode: seeded.length ? "database+reference" as const : "reference" as const };
  } catch (error) {
    if (!(error instanceof DatabaseServiceUnavailableError)) console.error("Seeded Resource Provider read failed", error);
    return { records: exchangeSeed, catalogMode: "reference" as const };
  }
}

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });
  const lens = lensParam as ExchangeLens;
  const state = searchStateFromParams(request.nextUrl.searchParams);
  const catalog = await recordsForLens(lens);
  const response = searchExchangeRecords(catalog.records, lens, state);
  const bounds = boundsFromRequest(request);
  const records = scopeMapRecordsToBounds(response.results.map((result) => result.record), bounds);
  const mapped = records.filter((record) => record.location).length;
  const viewer = deriveReferenceViewerContext(catalog.records);

  return NextResponse.json({
    lens,
    state,
    bounds,
    catalogMode: catalog.catalogMode,
    records,
    matches: response.results.filter((result) => records.some((record) => record.id === result.record.id)).map((result) => ({ id: result.record.id, ...result.match })),
    summary: { total: records.length, mapped, offMap: records.length - mapped },
    actions: lensDefinitions[lens].actions(viewer),
  });
}
