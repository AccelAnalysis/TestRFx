import { randomUUID } from "node:crypto";
import type { ExchangeActor } from "./exchange-actor";
import { withTransaction } from "./database";

export type CapabilityWorkflowAction = "upsert-evidence" | "remove-evidence" | "publish";

export interface CapabilityEvidenceInput {
  id?: unknown;
  kind?: unknown;
  label?: unknown;
  issuer?: unknown;
  note?: unknown;
}

type EvidenceItem = { id: string; kind: string; label: string; issuer?: string; note?: string };

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function parseEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const id = text(record.id); const kind = text(record.kind); const label = text(record.label);
    if (!id || !kind || !label) return [];
    return [{ id, kind, label, issuer: text(record.issuer), note: text(record.note) }];
  });
}

async function ownedCapability(client: Parameters<Parameters<typeof withTransaction>[0]>[0], publicId: string, actor: ExchangeActor) {
  const result = await client.query<{ exchange_record_id: string; capability_id: string; evidence: unknown; amacs_node_id: string | null; evidence_state: string }>(`
    SELECT er.id::text AS exchange_record_id, c.id::text AS capability_id, c.evidence, c.amacs_node_id, c.evidence_state
    FROM exchange_records er
    JOIN capabilities c ON c.exchange_record_id = er.id
    WHERE er.public_id = $1 AND er.organization_id = $2::uuid
    LIMIT 1
  `, [publicId, actor.organizationId]);
  const row = result.rows[0];
  if (!row) throw new Error("Capability record not found or not manageable by the active organization.");
  return row;
}

async function emitActivity(client: Parameters<Parameters<typeof withTransaction>[0]>[0], actor: ExchangeActor, exchangeRecordId: string, eventName: string, payload: Record<string, unknown> = {}) {
  await client.query(`INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload) VALUES ($1, $2, $3, $4, $5::jsonb)`, [eventName, actor.userId, actor.organizationId, exchangeRecordId, JSON.stringify(payload)]);
}

export async function executeCapabilityWorkflow({ action, actor, recordId, payload = {} }: { action: CapabilityWorkflowAction; actor: ExchangeActor; recordId: string; payload?: Record<string, unknown> }) {
  return withTransaction(async (client) => {
    const target = await ownedCapability(client, recordId, actor);
    const evidence = parseEvidence(target.evidence);

    if (action === "upsert-evidence") {
      const id = text(payload.id) ?? randomUUID();
      const kind = text(payload.kind); const label = text(payload.label);
      if (!kind || !label) throw new Error("Evidence type and label are required.");
      const nextItem: EvidenceItem = { id, kind, label, issuer: text(payload.issuer), note: text(payload.note) };
      const existingIndex = evidence.findIndex((item) => item.id === id);
      if (existingIndex >= 0) evidence[existingIndex] = nextItem; else evidence.push(nextItem);
      await client.query(`UPDATE capabilities SET evidence = $2::jsonb, evidence_state = $3 WHERE id = $1`, [target.capability_id, JSON.stringify(evidence), evidence.length ? "supported" : "unverified"]);
      await client.query("UPDATE exchange_records SET updated_at = now() WHERE id = $1", [target.exchange_record_id]);
      await emitActivity(client, actor, target.exchange_record_id, existingIndex >= 0 ? "CapabilityEvidenceUpdated" : "CapabilityEvidenceAdded", { evidenceId: id, kind });
      return { action, durable: true, recordId, evidence: nextItem, evidenceCount: evidence.length };
    }

    if (action === "remove-evidence") {
      const evidenceId = text(payload.evidenceId);
      if (!evidenceId) throw new Error("evidenceId is required.");
      const next = evidence.filter((item) => item.id !== evidenceId);
      if (next.length === evidence.length) throw new Error("Evidence item not found.");
      await client.query(`UPDATE capabilities SET evidence = $2::jsonb, evidence_state = $3 WHERE id = $1`, [target.capability_id, JSON.stringify(next), next.length ? "supported" : "unverified"]);
      await client.query("UPDATE exchange_records SET updated_at = now() WHERE id = $1", [target.exchange_record_id]);
      await emitActivity(client, actor, target.exchange_record_id, "CapabilityEvidenceRemoved", { evidenceId });
      return { action, durable: true, recordId, evidenceCount: next.length };
    }

    if (action === "publish") {
      await client.query("UPDATE exchange_records SET status = 'active', metadata = metadata || $2::jsonb, updated_at = now() WHERE id = $1", [target.exchange_record_id, JSON.stringify({ published: true, publishedAt: new Date().toISOString() })]);
      await emitActivity(client, actor, target.exchange_record_id, "CapabilityPublished", { amacsMapped: Boolean(target.amacs_node_id), evidenceCount: evidence.length });
      return { action, durable: true, recordId, status: "active", amacsMapped: Boolean(target.amacs_node_id), evidenceCount: evidence.length };
    }

    throw new Error(`Unsupported capability workflow: ${action}`);
  });
}

export async function getCapabilityWorkflowDetail(recordId: string, actor: ExchangeActor) {
  return withTransaction(async (client) => {
    const result = await client.query<{ public_id: string; title: string; summary: string; organization_id: string; organization_name: string; status: string; amacs_node_id: string | null; evidence_state: string; evidence: unknown; owned_by_viewer: boolean }>(`
      SELECT er.public_id, er.title, er.summary, er.organization_id::text, o.name AS organization_name, er.status,
             c.amacs_node_id, c.evidence_state, c.evidence, (m.user_id IS NOT NULL) AS owned_by_viewer
      FROM exchange_records er
      JOIN organizations o ON o.id = er.organization_id
      JOIN capabilities c ON c.exchange_record_id = er.id
      LEFT JOIN organization_memberships m ON m.organization_id = er.organization_id AND m.user_id = $2::uuid
      WHERE er.public_id = $1
      LIMIT 1
    `, [recordId, actor.userId]);
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      recordId: row.public_id,
      title: row.title,
      summary: row.summary,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      status: row.status,
      amacsNodeId: row.amacs_node_id,
      evidenceState: row.evidence_state,
      evidence: parseEvidence(row.evidence),
      ownedByViewer: row.owned_by_viewer,
    };
  });
}
