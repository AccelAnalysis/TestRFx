import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor, ExchangeForbiddenError, ExchangeUnauthorizedError } from "@/lib/server/exchange/actor";
import { setGeographicScope, GeographicScopeError } from "@/lib/server/geography/scope-service";
import type { GeographicScope, GeographicScopeKind } from "@/lib/geography/contracts";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const payload = await request.json() as {
      target?: "organization" | "record";
      kind?: GeographicScopeKind;
      recordId?: string;
      mode?: GeographicScope["mode"];
      label?: string;
      geographyIds?: string[];
      address?: GeographicScope["address"];
      point?: GeographicScope["point"];
      radiusMeters?: number;
    };
    if (!payload.target || !payload.kind || !payload.mode) {
      return NextResponse.json({ error: "target, kind, and mode are required." }, { status: 400 });
    }
    const result = await setGeographicScope({
      actor,
      target: payload.target,
      kind: payload.kind,
      recordId: payload.recordId,
      mode: payload.mode,
      label: payload.label,
      geographyIds: payload.geographyIds,
      address: payload.address,
      point: payload.point,
      radiusMeters: payload.radiusMeters,
    });
    return NextResponse.json({ accepted: true, durable: true, ...result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ExchangeUnauthorizedError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ExchangeForbiddenError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof GeographicScopeError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Geographic scope could not be saved." }, { status: 500 });
  }
}
