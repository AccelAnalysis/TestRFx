import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { DatabaseUnavailableError, query } from "@/lib/server/database";

const allowedEvents = new Set(["RecordCardOpened", "RecordViewed"]);

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const body = await request.json().catch(() => null) as { recordId?: string; eventName?: string } | null;
    if (!body?.recordId || !body.eventName || !allowedEvents.has(body.eventName)) return NextResponse.json({ error: "Unsupported activity event." }, { status: 400 });
    const result = await query<{ id: string }>(`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      SELECT $1, $2, $3, er.id, '{}'::jsonb
      FROM exchange_records er
      WHERE er.public_id = $4
      RETURNING id::text
    `, [body.eventName, actor.userId, actor.organizationId, body.recordId]);
    if (!result.rows[0]) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    return NextResponse.json({ accepted: true, activityEventId: result.rows[0].id });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record activity." }, { status: 400 });
  }
}
