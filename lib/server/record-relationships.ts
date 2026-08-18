import type { PoolClient } from "pg";
import type { ExchangeRecord, ExchangeRelationshipState } from "@/lib/exchange/contracts";
import type { ExchangeActor } from "./exchange-actor";
import { withTransaction } from "./database";

export type DurableRelationshipKind = "saved" | "watching" | "tracking" | "following";

const allowedByType: Record<DurableRelationshipKind, ExchangeRecord["type"][] | "all"> = {
  saved: "all",
  watching: ["rfx"],
  tracking: ["intelligence"],
  following: ["capability"],
};

function eventName(kind: DurableRelationshipKind, active: boolean) {
  const stem = kind === "saved" ? "Saved" : kind === "watching" ? "Watched" : kind === "tracking" ? "Tracked" : "Followed";
  return active ? `Record${stem}` : `Record${stem}Removed`;
}

export function relationshipAllowed(kind: DurableRelationshipKind, record: ExchangeRecord) {
  const allowed = allowedByType[kind];
  return allowed === "all" || allowed.includes(record.type);
}

async function recordUuid(client: PoolClient, publicId: string) {
  const result = await client.query<{ id: string }>("SELECT id::text FROM exchange_records WHERE public_id = $1 LIMIT 1", [publicId]);
  return result.rows[0]?.id;
}

export async function setRecordRelationship(actor: ExchangeActor, record: ExchangeRecord, kind: DurableRelationshipKind, active: boolean) {
  if (!relationshipAllowed(kind, record)) throw new Error(`Relationship ${kind} is not valid for ${record.type}.`);
  return withTransaction(async (client) => {
    const exchangeRecordId = await recordUuid(client, record.id);
    if (!exchangeRecordId) throw new Error("Record not found.");
    if (active) {
      await client.query(`
        INSERT INTO record_relationships (user_id, exchange_record_id, relationship_kind)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, exchange_record_id, relationship_kind)
        DO UPDATE SET updated_at = now()
      `, [actor.userId, exchangeRecordId, kind]);
      if (kind === "saved") {
        await client.query(`INSERT INTO favorites (user_id, exchange_record_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [actor.userId, exchangeRecordId]);
      }
    } else {
      await client.query(`DELETE FROM record_relationships WHERE user_id = $1 AND exchange_record_id = $2 AND relationship_kind = $3`, [actor.userId, exchangeRecordId, kind]);
      if (kind === "saved") await client.query(`DELETE FROM favorites WHERE user_id = $1 AND exchange_record_id = $2`, [actor.userId, exchangeRecordId]);
    }
    await client.query(`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ($1, $2, $3, $4, $5::jsonb)
    `, [eventName(kind, active), actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify({ relationshipKind: kind, active })]);
    const current = await client.query<{ relationship_kind: DurableRelationshipKind }>(`
      SELECT relationship_kind FROM record_relationships
      WHERE user_id = $1 AND exchange_record_id = $2
      ORDER BY relationship_kind
    `, [actor.userId, exchangeRecordId]);
    return current.rows.map((row) => row.relationship_kind);
  });
}

export function projectRelationshipStates(kinds: DurableRelationshipKind[]): ExchangeRelationshipState[] {
  return kinds.map((kind) => kind === "watching" ? "watched" : kind === "tracking" || kind === "following" ? "following" : "saved");
}
