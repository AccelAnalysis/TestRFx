import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ExchangeAuthenticationError, resolveExchangeActor } from "@/lib/server/exchange-actor";
import { assertExchangeActorMembership } from "@/lib/server/exchange-authorization";
import { ExchangeServiceUnavailableError, withExchangeTransaction } from "@/lib/server/database";

export const runtime = "nodejs";

type Command = "add" | "edit" | "note" | "compare";
interface IntelligenceRow { exchange_record_id: string; intelligence_record_id: string; public_id: string; organization_id: string; organization_name: string; title: string; summary: string; signal_type: string | null; observed_at: string | null; source_context: Record<string, unknown>; }

function fail(error: unknown) {
  if (error instanceof ExchangeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Intelligence workflow failed." }, { status: 422 });
}

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

async function findInsight(client: import("pg").PoolClient, publicId: string) {
  const result = await client.query<IntelligenceRow>(`SELECT er.id AS exchange_record_id, ir.id AS intelligence_record_id, er.public_id, er.organization_id, o.name AS organization_name, er.title, er.summary, ir.signal_type, ir.observed_at, ir.source_context FROM exchange_records er JOIN intelligence_records ir ON ir.exchange_record_id=er.id JOIN organizations o ON o.id=er.organization_id WHERE er.public_id=$1 AND er.record_type='intelligence'`, [publicId]);
  if (!result.rows[0]) throw new Error("Intelligence record not found.");
  return result.rows[0];
}

async function activity(client: import("pg").PoolClient, eventName: string, actor: { userId: string; organizationId: string }, recordId: string, payload: Record<string, unknown>) {
  await client.query("INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)", [eventName, actor.userId, actor.organizationId, recordId, JSON.stringify(payload)]);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { command?: Command; recordId?: string; input?: Record<string, unknown>; note?: string; comparisonId?: string } | null;
  if (!body?.command) return NextResponse.json({ error: "command is required" }, { status: 400 });
  try {
    const actor = resolveExchangeActor(request.headers);
    const result = await withExchangeTransaction(async (client) => {
      await assertExchangeActorMembership(client, actor);

      if (body.command === "add") {
        const input = body.input ?? {};
        const title = stringValue(input.title); const summary = stringValue(input.summary); const geography = stringValue(input.geography);
        if (!title || !summary || !geography) throw new Error("Insight title, observation, and geography are required.");
        const publicId = `intel-${randomUUID()}`;
        const record = await client.query<{ id: string }>(`INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, status, metadata) VALUES ($1,'intelligence',$2,$3,$4,'active',$5::jsonb) RETURNING id`, [publicId, actor.organizationId, title, summary, JSON.stringify({ geography })]);
        const signalType = stringValue(input.signalType) || "Participant insight"; const sourceLabel = stringValue(input.sourceLabel) || "Participant observation"; const observedPeriod = stringValue(input.observedPeriod);
        const intelligence = await client.query<{ id: string }>(`INSERT INTO intelligence_records (exchange_record_id, signal_type, observed_at, source_context, source_type, provenance) VALUES ($1,$2,now(),$3::jsonb,'participant-observation',$4::jsonb) RETURNING id`, [record.rows[0].id, signalType, JSON.stringify({ sourceLabel, observedPeriod, geography }), JSON.stringify({ contributedByUserId: actor.userId, contributedByOrganizationId: actor.organizationId })]);
        await client.query(`INSERT INTO intelligence_sources (intelligence_record_id, source_label, source_type, coverage, methodology, observed_at) VALUES ($1,$2,'participant-observation',$3::jsonb,'{}'::jsonb,now())`, [intelligence.rows[0].id, sourceLabel, JSON.stringify({ geography, observedPeriod })]);
        const org = await client.query<{ name: string }>("SELECT name FROM organizations WHERE id=$1", [actor.organizationId]);
        await activity(client, "IntelligenceInsightAdded", actor, record.rows[0].id, { signalType });
        return { publicId, organization: org.rows[0]?.name ?? "Active organization", title, summary, geography, signalType, observedPeriod, sourceLabel };
      }

      if (!body.recordId) throw new Error("recordId is required for this Intelligence workflow.");
      const insight = await findInsight(client, body.recordId);

      if (body.command === "note") {
        const note = stringValue(body.note);
        if (!note) throw new Error("Note body is required.");
        const row = await client.query<{ id: string }>(`INSERT INTO intelligence_notes (intelligence_record_id, author_user_id, organization_id, visibility, body) VALUES ($1,$2,$3,'organization',$4) RETURNING id`, [insight.intelligence_record_id, actor.userId, actor.organizationId, note]);
        await activity(client, "IntelligenceNoteAdded", actor, insight.exchange_record_id, { noteId: row.rows[0].id });
        return { noteId: row.rows[0].id, visibility: "organization" };
      }

      if (body.command === "compare") {
        const comparisonId = stringValue(body.comparisonId);
        if (!comparisonId) throw new Error("comparisonId is required for Intelligence comparison.");
        const comparison = await findInsight(client, comparisonId);
        await activity(client, "IntelligenceCompared", actor, insight.exchange_record_id, { comparisonRecordId: comparison.public_id });
        const project = (row: IntelligenceRow) => ({ publicId: row.public_id, title: row.title, organization: row.organization_name, summary: row.summary, signalType: row.signal_type, observedAt: row.observed_at, sourceContext: row.source_context });
        return { selected: project(insight), comparison: project(comparison) };
      }

      if (insight.organization_id !== actor.organizationId) throw new Error("The active organization is not authorized to edit this Intelligence record.");
      const input = body.input ?? {};
      const title = stringValue(input.title) || insight.title; const summary = stringValue(input.summary) || insight.summary; const geography = stringValue(input.geography);
      const signalType = stringValue(input.signalType) || insight.signal_type || "Participant insight"; const sourceLabel = stringValue(input.sourceLabel); const observedPeriod = stringValue(input.observedPeriod);
      await client.query("UPDATE exchange_records SET title=$1, summary=$2, metadata=$3::jsonb, updated_at=now() WHERE id=$4", [title, summary, JSON.stringify({ geography }), insight.exchange_record_id]);
      await client.query("UPDATE intelligence_records SET signal_type=$1, source_context=$2::jsonb, provenance=provenance || $3::jsonb WHERE id=$4", [signalType, JSON.stringify({ sourceLabel, observedPeriod, geography }), JSON.stringify({ lastEditedByUserId: actor.userId, lastEditedAt: new Date().toISOString() }), insight.intelligence_record_id]);
      await activity(client, "IntelligenceInsightUpdated", actor, insight.exchange_record_id, { signalType });
      return { publicId: insight.public_id, title, summary, geography, signalType, observedPeriod, sourceLabel };
    });
    return NextResponse.json({ accepted: true, durable: true, result }, { status: 201 });
  } catch (error) { return fail(error); }
}
