import { NextRequest, NextResponse } from "next/server";
import type { ExchangeLens } from "@/lib/exchange/contracts";
import { capabilityExchangeRecords } from "@/lib/capabilities/reference";
import { intelligenceSeed } from "@/lib/exchange/intelligence";
import { exchangeSeed } from "@/lib/exchange/seed";
import { lensDefinitions } from "@/lib/exchange/lenses";
import { searchExchangeRecords, searchStateFromParams } from "@/lib/exchange/search";
import { resolveServerActor } from "@/lib/server/actor-context";
import { databaseConfigured, ExchangeServiceUnavailableError } from "@/lib/server/postgres";
import { listExchangeRecords } from "@/lib/server/exchange-results-service";

const lenses = new Set<ExchangeLens>(["rfx", "resources", "intelligence", "capabilities"]);
const referenceRecords = [
  ...exchangeSeed.filter((record) => record.type !== "intelligence" && record.type !== "capability"),
  ...intelligenceSeed,
  ...capabilityExchangeRecords,
];

function referenceRuntime() {
  return process.env.RFXCHANGE_REFERENCE_MODE === "1" || process.env.NODE_ENV !== "production";
}

export async function GET(request: NextRequest) {
  const lensParam = request.nextUrl.searchParams.get("lens") ?? "rfx";
  if (!lenses.has(lensParam as ExchangeLens)) return NextResponse.json({ error: "Unsupported lens" }, { status: 400 });

  const lens = lensParam as ExchangeLens;
  const state = searchStateFromParams(request.nextUrl.searchParams);
  const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 40);

  if (!databaseConfigured()) {
    if (!referenceRuntime()) {
      return NextResponse.json({ error: "Exchange data service unavailable", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
    }
    const response = searchExchangeRecords(referenceRecords, lens, state);
    const records = response.results.map((result) => result.record);
    return NextResponse.json({
      lens,
      state,
      records,
      matches: response.results.map((result) => ({ id: result.record.id, ...result.match })),
      summary: { total: response.total, mapped: response.mapped, offMap: response.offMap },
      actions: lensDefinitions[lens].actions(records[0]),
      nextCursor: null,
      serviceMode: "reference",
    });
  }

  try {
    let actorOrganizationId: string | undefined;
    if (process.env.RFXCHANGE_TRUST_IDENTITY_HEADERS === "1") {
      try { actorOrganizationId = (await resolveServerActor(request)).organizationId; } catch { actorOrganizationId = undefined; }
    }
    const page = await listExchangeRecords({ lens, state, cursor, limit: Number.isFinite(limit) ? limit : 40, actorOrganizationId });
    return NextResponse.json({
      lens,
      state,
      records: page.records,
      summary: { total: page.total, mapped: page.mapped, offMap: page.offMap },
      actions: lensDefinitions[lens].actions(page.records[0]),
      nextCursor: page.nextCursor ?? null,
      serviceMode: "postgres",
    });
  } catch (error) {
    if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error("Exchange results service failed", error);
    return NextResponse.json({ error: "Exchange results could not be loaded" }, { status: 500 });
  }
}
