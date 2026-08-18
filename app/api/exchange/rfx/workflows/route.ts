import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ExchangeAuthenticationError, resolveExchangeActor } from "@/lib/server/exchange-actor";
import { assertExchangeActorMembership } from "@/lib/server/exchange-authorization";
import { ExchangeServiceUnavailableError, withExchangeTransaction } from "@/lib/server/database";

export const runtime = "nodejs";

type Command = "draft" | "save" | "publish" | "respond-submit" | "responses-matches" | "update" | "close" | "award-advance";
interface RecordRow { id: string; public_id: string; title: string; summary: string; organization_id: string; organization_name: string; lifecycle_status: string; }

function errorResponse(error: unknown) {
  if (error instanceof ExchangeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  const message = error instanceof Error ? error.message : "RFx workflow failed.";
  return NextResponse.json({ error: message }, { status: /required|not found|not allowed|cannot respond/i.test(message) ? 422 : 500 });
}

async function findRecord(client: import("pg").PoolClient, publicId: string) {
  const result = await client.query<RecordRow>(`SELECT er.id, er.public_id, er.title, er.summary, er.organization_id, o.name AS organization_name, rr.lifecycle_status FROM exchange_records er JOIN organizations o ON o.id=er.organization_id JOIN rfx_records rr ON rr.exchange_record_id=er.id WHERE er.public_id=$1 AND er.record_type='rfx'`, [publicId]);
  if (!result.rows[0]) throw new Error("RFx record not found.");
  return result.rows[0];
}

async function requireOwned(client: import("pg").PoolClient, publicId: string, organizationId: string) {
  const record = await findRecord(client, publicId);
  if (record.organization_id !== organizationId) throw new Error("This RFx management action is not allowed for the active organization.");
  return record;
}

async function recordActivity(client: import("pg").PoolClient, eventName: string, actor: { userId: string; organizationId: string }, exchangeRecordId: string, payload: Record<string, unknown>) {
  await client.query("INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)", [eventName, actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify(payload)]);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { command?: Command; recordId?: string; payload?: Record<string, unknown> } | null;
  if (!body?.command) return NextResponse.json({ error: "command is required" }, { status: 400 });
  const payload = body.payload ?? {};

  try {
    const actor = resolveExchangeActor(request.headers);
    const result = await withExchangeTransaction(async (client) => {
      await assertExchangeActorMembership(client, actor);

      if (body.command === "draft" || body.command === "save" || body.command === "publish") {
        const title = typeof payload.title === "string" ? payload.title.trim() : "";
        const summary = typeof payload.summary === "string" ? payload.summary.trim() : "";
        const solicitationType = typeof payload.solicitationType === "string" ? payload.solicitationType.trim() : null;
        if (!title || !summary) throw new Error("RFx title and summary are required.");
        const lifecycle = body.command === "publish" ? "open" : "draft";
        if (body.recordId) {
          const existing = await requireOwned(client, body.recordId, actor.organizationId);
          await client.query("UPDATE exchange_records SET title=$1, summary=$2, status=$3, updated_at=now() WHERE id=$4", [title, summary, lifecycle === "open" ? "active" : "draft", existing.id]);
          await client.query("UPDATE rfx_records SET solicitation_type=$1, lifecycle_status=$2 WHERE exchange_record_id=$3", [solicitationType, lifecycle, existing.id]);
          await recordActivity(client, body.command === "publish" ? "RFxPublished" : "RFxSaved", actor, existing.id, { lifecycle });
          return { publicId: existing.public_id, title, summary, organization: existing.organization_name, status: lifecycle };
        }
        const publicId = `rfx-${randomUUID()}`;
        const created = await client.query<{ id: string }>(`INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status) VALUES ($1,'rfx',$2,$3,$4,$5) RETURNING id`, [publicId, actor.organizationId, title, summary, lifecycle === "open" ? "active" : "draft"]);
        await client.query("INSERT INTO rfx_records (exchange_record_id, solicitation_type, source, lifecycle_status) VALUES ($1,$2,'rfxchange',$3)", [created.rows[0].id, solicitationType, lifecycle]);
        const organization = await client.query<{ name: string }>("SELECT name FROM organizations WHERE id=$1", [actor.organizationId]);
        await recordActivity(client, body.command === "publish" ? "RFxPublished" : "RFxDraftCreated", actor, created.rows[0].id, { lifecycle });
        return { publicId, title, summary, organization: organization.rows[0]?.name ?? "Active organization", status: lifecycle };
      }

      if (!body.recordId) throw new Error("recordId is required for this RFx workflow.");
      const record = await findRecord(client, body.recordId);

      if (body.command === "respond-submit") {
        if (record.organization_id === actor.organizationId) throw new Error("An organization cannot respond to its own RFx through the external response workflow.");
        const responseData = typeof payload.response === "string" ? { response: payload.response } : payload;
        const response = await client.query<{ id: string }>(`INSERT INTO rfx_responses (rfx_record_id, respondent_organization_id, status, response_data, submitted_at) SELECT rr.id,$1,'submitted',$2::jsonb,now() FROM rfx_records rr WHERE rr.exchange_record_id=$3 ON CONFLICT (rfx_record_id, respondent_organization_id) DO UPDATE SET status='submitted', response_data=excluded.response_data, submitted_at=now(), updated_at=now() RETURNING id`, [actor.organizationId, JSON.stringify(responseData), record.id]);
        await recordActivity(client, "RFxResponseSubmitted", actor, record.id, { responseId: response.rows[0].id });
        return { responseId: response.rows[0].id, status: "submitted" };
      }

      const owned = await requireOwned(client, body.recordId, actor.organizationId);
      if (body.command === "responses-matches") {
        const responses = await client.query<{ id: string; organization: string; status: string; submitted_at: string | null }>(`SELECT rsp.id, o.name AS organization, rsp.status, rsp.submitted_at FROM rfx_responses rsp JOIN rfx_records rr ON rr.id=rsp.rfx_record_id JOIN organizations o ON o.id=rsp.respondent_organization_id WHERE rr.exchange_record_id=$1 ORDER BY rsp.submitted_at DESC NULLS LAST`, [owned.id]);
        const matches = await client.query<{ public_id: string; title: string; score: number; status: string }>(`SELECT er.public_id, er.title, md.score, md.status FROM match_decisions md JOIN exchange_records er ON er.id=md.matched_exchange_record_id WHERE md.source_exchange_record_id=$1 ORDER BY md.score DESC NULLS LAST`, [owned.id]);
        return { responses: responses.rows, matches: matches.rows };
      }
      if (body.command === "update") {
        const title = typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : owned.title;
        const summary = typeof payload.summary === "string" && payload.summary.trim() ? payload.summary.trim() : owned.summary;
        await client.query("UPDATE exchange_records SET title=$1, summary=$2, updated_at=now() WHERE id=$3", [title, summary, owned.id]);
        await recordActivity(client, "RFxUpdated", actor, owned.id, { title });
        return { publicId: owned.public_id, title, summary, status: owned.lifecycle_status };
      }
      if (body.command === "close") {
        await client.query("UPDATE exchange_records SET status='closed', updated_at=now() WHERE id=$1", [owned.id]);
        await client.query("UPDATE rfx_records SET lifecycle_status='closed' WHERE exchange_record_id=$1", [owned.id]);
        await recordActivity(client, "RFxClosed", actor, owned.id, {});
        return { publicId: owned.public_id, status: "closed" };
      }
      if (body.command === "award-advance") {
        const responseId = typeof payload.responseId === "string" ? payload.responseId : "";
        if (!responseId) throw new Error("A response is required to Award / Advance.");
        const selected = await client.query<{ id: string }>(`UPDATE rfx_responses rsp SET status='selected', updated_at=now() FROM rfx_records rr WHERE rsp.id=$1 AND rsp.rfx_record_id=rr.id AND rr.exchange_record_id=$2 RETURNING rsp.id`, [responseId, owned.id]);
        if (!selected.rows[0]) throw new Error("Selected response was not found for this RFx.");
        await client.query("UPDATE rfx_records SET lifecycle_status='selected' WHERE exchange_record_id=$1", [owned.id]);
        await client.query("UPDATE exchange_records SET status='selected', updated_at=now() WHERE id=$1", [owned.id]);
        await recordActivity(client, "RFxAwardAdvanced", actor, owned.id, { responseId });
        return { publicId: owned.public_id, responseId, status: "selected" };
      }
      throw new Error("Unsupported RFx workflow command.");
    });
    return NextResponse.json({ accepted: true, durable: true, result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
