import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { IdentitySessionUnauthorizedError } from "@/lib/identity/session-gateway";
import { actorCanWriteRfx, resolveRfxActor } from "@/lib/rfx/runtime-actor";

export const runtime = "nodejs";

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("RFx reuse requires DATABASE_URL.");
  return neon(url);
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Previous RFx records are unavailable.";
  if (error instanceof IdentitySessionUnauthorizedError) return NextResponse.json({ error: message }, { status: 401 });
  if (message.includes("DATABASE_URL") || message.includes("session service") || message.includes("RFXCHANGE_IDENTITY_SESSION_ENDPOINT")) return NextResponse.json({ error: message }, { status: 503 });
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveRfxActor(request);
    if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot create or reuse RFx records.");
    const exclude = request.nextUrl.searchParams.get("exclude")?.trim();
    const sql = database();
    const rows = await sql.query(
      `SELECT er.public_id,
              er.title,
              er.summary,
              er.updated_at,
              rr.solicitation_type,
              rr.lifecycle_status,
              rr.due_at,
              rr.performance_geography,
              rr.estimated_value,
              rr.scope,
              rr.deliverables,
              rr.response_requirements,
              rr.evaluation_method,
              rr.requirements
         FROM exchange_records er
         JOIN rfx_records rr ON rr.exchange_record_id = er.id
        WHERE er.organization_id::text = $1
          AND er.record_type = 'rfx'
          AND ($2::text IS NULL OR er.public_id <> $2)
        ORDER BY COALESCE(rr.issued_at, er.updated_at, er.created_at) DESC
        LIMIT 12`,
      [actor.organizationId, exclude || null],
    ) as Array<Record<string, unknown>>;

    return NextResponse.json({
      records: rows.map((row) => ({
        id: String(row.public_id),
        title: String(row.title ?? "RFx"),
        summary: String(row.summary ?? ""),
        rfxType: String(row.solicitation_type ?? "RFP"),
        status: String(row.lifecycle_status ?? "draft"),
        updatedAt: row.updated_at ? String(row.updated_at) : undefined,
        dueAt: row.due_at ? String(row.due_at) : undefined,
        geography: row.performance_geography ?? {},
        estimatedValue: row.estimated_value ?? {},
        scope: row.scope ?? {},
        deliverables: row.deliverables ?? [],
        responseRequirements: row.response_requirements ?? [],
        evaluationMethod: row.evaluation_method ?? {},
        requirements: row.requirements ?? {},
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
