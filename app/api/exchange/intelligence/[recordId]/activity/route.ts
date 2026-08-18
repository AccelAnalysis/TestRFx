import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/server/database";
import { requireExchangeActor } from "@/lib/server/exchange-session";
import { serviceErrorResponse } from "@/lib/server/http-errors";

export async function GET(request: NextRequest, context: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await requireExchangeActor(request);
    const { recordId } = await context.params;
    const sql = getDatabase();
    const rows = await sql`
      SELECT ae.id::text, ae.event_name, ae.occurred_at
      FROM activity_events ae
      JOIN exchange_records er ON er.id = ae.exchange_record_id
      WHERE er.public_id = ${recordId}
        AND er.record_type = 'intelligence'
        AND (
          ae.event_name IN ('IntelligenceCreated', 'IntelligenceUpdated')
          OR ae.actor_user_id = ${actor.userId}::uuid
        )
      ORDER BY ae.occurred_at DESC, ae.id DESC
      LIMIT 100
    `;
    return NextResponse.json({
      events: rows.map((row) => ({
        id: String(row.id),
        eventName: String(row.event_name),
        occurredAt: row.occurred_at instanceof Date ? row.occurred_at.toISOString() : String(row.occurred_at),
      })),
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
