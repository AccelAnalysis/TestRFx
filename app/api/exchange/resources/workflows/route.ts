import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ExchangeAuthenticationError, resolveExchangeActor } from "@/lib/server/exchange-actor";
import { assertExchangeActorMembership } from "@/lib/server/exchange-authorization";
import { ExchangeServiceUnavailableError, withExchangeTransaction } from "@/lib/server/database";

export const runtime = "nodejs";

type Command = "offer" | "edit" | "request" | "archive";
interface ResourceRow { exchange_record_id: string; resource_id: string; public_id: string; organization_id: string; organization_name: string; title: string; summary: string; geography: string | null; }

function fail(error: unknown) {
  if (error instanceof ExchangeAuthenticationError) return NextResponse.json({ error: error.message }, { status: 401 });
  if (error instanceof ExchangeServiceUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "Resources workflow failed." }, { status: 422 });
}

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

async function findResource(client: import("pg").PoolClient, publicId: string) {
  const result = await client.query<ResourceRow>(`SELECT er.id AS exchange_record_id, r.id AS resource_id, er.public_id, er.organization_id, o.name AS organization_name, er.title, er.summary, COALESCE(l.label, '') AS geography FROM exchange_records er JOIN resources r ON r.exchange_record_id=er.id JOIN organizations o ON o.id=er.organization_id LEFT JOIN locations l ON l.id=er.location_id WHERE er.public_id=$1 AND er.record_type='resource'`, [publicId]);
  if (!result.rows[0]) throw new Error("Resource record not found.");
  return result.rows[0];
}

async function activity(client: import("pg").PoolClient, eventName: string, actor: { userId: string; organizationId: string }, exchangeRecordId: string, payload: Record<string, unknown>) {
  await client.query("INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1,$2,$3,$4,$5::jsonb)", [eventName, actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify(payload)]);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { command?: Command; recordId?: string; draft?: Record<string, unknown>; request?: Record<string, unknown> } | null;
  if (!body?.command) return NextResponse.json({ error: "command is required" }, { status: 400 });
  try {
    const actor = resolveExchangeActor(request.headers);
    const result = await withExchangeTransaction(async (client) => {
      await assertExchangeActorMembership(client, actor);

      if (body.command === "offer") {
        const draft = body.draft ?? {};
        const title = stringValue(draft.title); const summary = stringValue(draft.summary); const category = stringValue(draft.category);
        if (!title || !summary || !category) throw new Error("Resource title, description, and category are required.");
        const location = stringValue(draft.visibility) === "public-location" ? await client.query<{ id: string }>("SELECT id FROM locations WHERE organization_id=$1 ORDER BY created_at LIMIT 1", [actor.organizationId]) : undefined;
        const publicId = `res-${randomUUID()}`;
        const record = await client.query<{ id: string }>(`INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, status, metadata) VALUES ($1,'resource',$2,$3,$4,$5,'active',$6::jsonb) RETURNING id`, [publicId, actor.organizationId, location?.rows[0]?.id ?? null, title, summary, JSON.stringify({ category, geography: stringValue(draft.geography) })]);
        const availability = { state: stringValue(draft.availability) || "available", label: stringValue(draft.availabilityLabel), serviceArea: stringValue(draft.serviceArea) };
        await client.query(`INSERT INTO resources (exchange_record_id, resource_mode, availability, category, capacity, visibility, terms) VALUES ($1,'offer',$2::jsonb,$3,$4::jsonb,$5,$6::jsonb)`, [record.rows[0].id, JSON.stringify(availability), category, JSON.stringify({ label: stringValue(draft.capacity) }), stringValue(draft.visibility) || "public-location", JSON.stringify({ text: stringValue(draft.terms) })]);
        const org = await client.query<{ name: string }>("SELECT name FROM organizations WHERE id=$1", [actor.organizationId]);
        await activity(client, "ResourceOffered", actor, record.rows[0].id, { publicId, category });
        return { publicId, organization: org.rows[0]?.name ?? "Active organization", status: "active" };
      }

      if (!body.recordId) throw new Error("recordId is required for this Resources workflow.");
      const resource = await findResource(client, body.recordId);

      if (body.command === "request") {
        if (resource.organization_id === actor.organizationId) throw new Error("Use resource management rather than requesting your own resource.");
        const requestDetails = body.request ?? {};
        const row = await client.query<{ id: string }>(`INSERT INTO resource_requests (resource_id, requester_organization_id, provider_organization_id, requester_user_id, request_details, status) VALUES ($1,$2,$3,$4,$5::jsonb,'requested') RETURNING id`, [resource.resource_id, actor.organizationId, resource.organization_id, actor.userId, JSON.stringify(requestDetails)]);
        await activity(client, "ResourceRequested", actor, resource.exchange_record_id, { requestId: row.rows[0].id });
        return { requestId: row.rows[0].id, status: "requested", providerOrganization: resource.organization_name };
      }

      if (resource.organization_id !== actor.organizationId) throw new Error("The active organization is not authorized to manage this resource.");
      if (body.command === "archive") {
        await client.query("UPDATE resources SET archived_at=now() WHERE id=$1", [resource.resource_id]);
        await client.query("UPDATE exchange_records SET status='archived', updated_at=now() WHERE id=$1", [resource.exchange_record_id]);
        await activity(client, "ResourceArchived", actor, resource.exchange_record_id, {});
        return { publicId: resource.public_id, status: "archived" };
      }

      const draft = body.draft ?? {};
      const title = stringValue(draft.title) || resource.title; const summary = stringValue(draft.summary) || resource.summary; const category = stringValue(draft.category);
      const availability = { state: stringValue(draft.availability) || "available", label: stringValue(draft.availabilityLabel), serviceArea: stringValue(draft.serviceArea) };
      await client.query("UPDATE exchange_records SET title=$1, summary=$2, metadata=$3::jsonb, updated_at=now() WHERE id=$4", [title, summary, JSON.stringify({ category, geography: stringValue(draft.geography) }), resource.exchange_record_id]);
      await client.query("UPDATE resources SET availability=$1::jsonb, category=$2, capacity=$3::jsonb, visibility=$4, terms=$5::jsonb WHERE id=$6", [JSON.stringify(availability), category || null, JSON.stringify({ label: stringValue(draft.capacity) }), stringValue(draft.visibility) || "public-location", JSON.stringify({ text: stringValue(draft.terms) }), resource.resource_id]);
      await activity(client, "ResourceUpdated", actor, resource.exchange_record_id, { category });
      return { publicId: resource.public_id, title, summary, status: "active" };
    });
    return NextResponse.json({ accepted: true, durable: true, result }, { status: 201 });
  } catch (error) { return fail(error); }
}
