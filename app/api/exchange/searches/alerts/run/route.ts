import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { evaluateSavedSearchAlerts } from "@/lib/exchange/search-alerts";
import { DatabaseUnavailableError } from "@/lib/server/postgres";

function secretMatches(supplied: string, configured: string) {
  const left = Buffer.from(supplied);
  const right = Buffer.from(configured);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: NextRequest) {
  const configured = process.env.RFXCHANGE_SEARCH_ALERT_SECRET?.trim();
  if (!configured) return NextResponse.json({ error: "Search alert evaluation is not configured.", code: "alert_service_unconfigured" }, { status: 503 });
  const supplied = request.headers.get("x-rfx-search-alert-secret")?.trim() ?? "";
  if (!supplied || !secretMatches(supplied, configured)) return NextResponse.json({ error: "Unauthorized.", code: "unauthorized" }, { status: 401 });
  const requestedLimit = Number(request.nextUrl.searchParams.get("limit") ?? 100);
  try {
    const result = await evaluateSavedSearchAlerts(Number.isFinite(requestedLimit) ? requestedLimit : 100);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: "Search alert evaluation requires the RFxchange database.", code: error.code }, { status: 503 });
    console.error("Saved search alert run failed", error);
    return NextResponse.json({ error: "Saved search alert evaluation failed.", code: "alert_evaluation_failed" }, { status: 500 });
  }
}
