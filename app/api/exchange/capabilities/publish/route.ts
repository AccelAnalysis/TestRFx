import { NextRequest, NextResponse } from "next/server";
import { ExchangeAuthenticationError, resolveExchangeActor } from "@/lib/server/exchange-actor";
import { assertExchangeActorMembership } from "@/lib/server/exchange-authorization";
import { ExchangeServiceUnavailableError, withExchangeTransaction } from "@/lib/server/database";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { recordId?: string } | null;
  if (!body?.recordId) return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  try {
    const actor = resolveExchangeActor(request.headers);
    const result = await withExchangeTransaction(async (client) => {
      await assertExchangeActorMembership(client, actor);
      const record = await client.query<{ id: string; organization_id: string }>("SELECT id, organization_id FROM exchange_records WHERE public_id=$1 AND record_type='capability'", [body.recordId]);
      const row = record.rows[0];
      if (!row) throw new Error("Capability record not found.");
      if (row.organization_id !== actor.organizationId) throw new Error("The active organization is not authorized to publish this capability profile.");
      await client.query("UPDATE capabilities SET publication_status='published' WHERE exchange_record_id=$1", [row.id]);
      await client.query("UPDATE exchange_records SET status='active', updated_at=now() WHERE id=$1", [row.id]);
      await client.query("INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ('CapabilityPublished',$1,$2,$3,$4::jsonb)", [actor.userId, actor.organizationId, row.id, JSON.stringify({ publicationStatus: "published" })]);
      return { recordId: body.recordId, publicationStatus: "published", availableInExchange: true };
    });
    return NextResponse.json({ accepted: true, durable: true, result }, { status: 201 });
  } catch (error) {
    if (error instanceof ExchangeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Capability publication failed." }, { status: 422 });
  }
}
