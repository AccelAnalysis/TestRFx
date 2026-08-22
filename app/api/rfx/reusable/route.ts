import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import { IdentitySessionUnauthorizedError } from "@/lib/identity/session-gateway";
import type { RfxWorkspaceItem, RfxWorkspaceValue } from "@/lib/rfx/contracts";
import { savePostgresRfxWorkspace } from "@/lib/rfx/postgres-repository";
import { actorCanWriteRfx, resolveRfxActor } from "@/lib/rfx/runtime-actor";
import { completeWorkspaceNode, createRfxWorkspace, setWorkspaceValues } from "@/lib/rfx/workspace";

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
  if (message.includes("not found")) return NextResponse.json({ error: message }, { status: 404 });
  return NextResponse.json({ error: message }, { status: 500 });
}

function textFromJson(value: unknown, preferredKeys: string[] = []) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  for (const key of preferredKeys) {
    const candidate = record[key];
    if (typeof candidate === "string") return candidate;
  }
  for (const candidate of Object.values(record)) if (typeof candidate === "string") return candidate;
  return "";
}

function listFromJson(value: unknown): Array<{ label: string; note?: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): Array<{ label: string; note?: string }> => {
    if (typeof item === "string") return [{ label: item, note: undefined }];
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const label = [record.label, record.name, record.text, record.requirement].find((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
    if (!label) return [];
    const noteParts = [record.note, record.kind, record.priority, record.appliesTo].filter((candidate): candidate is string => typeof candidate === "string" && candidate.trim().length > 0);
    return [{ label, note: noteParts.length ? noteParts.join(" · ") : undefined }];
  });
}

async function listOwnedRfx(organizationId: string, exclude?: string) {
  const sql = database();
  return await sql.query(
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
    [organizationId, exclude || null],
  ) as Array<Record<string, unknown>>;
}

function publicRecord(row: Record<string, unknown>) {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveRfxActor(request);
    if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot create or reuse RFx records.");
    const exclude = request.nextUrl.searchParams.get("exclude")?.trim();
    const rows = await listOwnedRfx(actor.organizationId, exclude);
    return NextResponse.json({ records: rows.map(publicRecord) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveRfxActor(request);
    if (!actorCanWriteRfx(actor)) throw new IdentitySessionUnauthorizedError("Your organization role cannot create or reuse RFx records.");
    const payload = await request.json() as { sourceRecordId?: string; targetRecordId?: string };
    const sourceRecordId = payload.sourceRecordId?.trim();
    const targetRecordId = payload.targetRecordId?.trim();
    if (!sourceRecordId || !targetRecordId || sourceRecordId === targetRecordId) return NextResponse.json({ error: "A previous RFx and a different target draft are required." }, { status: 400 });
    if (!targetRecordId.startsWith("rfx-local-")) return NextResponse.json({ error: "Previous RFx reuse can only initialize a new RFx draft." }, { status: 409 });

    const rows = await listOwnedRfx(actor.organizationId);
    const source = rows.find((row) => String(row.public_id) === sourceRecordId);
    if (!source) throw new Error("Previous RFx was not found for the active organization.");

    const now = new Date().toISOString();
    const sourceSummary = String(source.summary ?? "");
    const sourceType = String(source.solicitation_type ?? "RFP");
    const sourceScope = textFromJson(source.scope, ["text", "summary"]);
    const geography = textFromJson(source.performance_geography, ["label", "text"]);
    const estimatedValue = textFromJson(source.estimated_value, ["label", "text"]);
    const responseInstructions = Array.isArray(source.response_requirements) ? source.response_requirements.filter((item): item is string => typeof item === "string").join("\n") : textFromJson(source.response_requirements, ["text"]);
    const evaluationNotes = textFromJson(source.evaluation_method, ["text", "label"]);

    let workspace = createRfxWorkspace(targetRecordId, "create-rfx");
    const values: Record<string, RfxWorkspaceValue> = {
      "mobile.needStatement": sourceSummary,
      "need.statement": sourceSummary,
      "need.startingPoint": "Previous RFx",
      "mobile.recommendedType": sourceType,
      "need.rfxType": sourceType,
      "experience.mode": "guided",
    };
    if (sourceScope) values["scope.summary"] = sourceScope;
    if (geography) values["capabilities.geography"] = geography;
    if (estimatedValue) values["commercial.estimatedValue"] = estimatedValue;
    if (responseInstructions) values["package.responseInstructions"] = responseInstructions;
    if (evaluationNotes) values["evaluation.notes"] = evaluationNotes;
    workspace = setWorkspaceValues(workspace, values);

    const items: RfxWorkspaceItem[] = [];
    for (const [index, item] of listFromJson(source.deliverables).entries()) items.push({ id: `reused-deliverable-${index}-${crypto.randomUUID()}`, nodeId: "deliverables", label: item.label, note: item.note, status: "reused-draft", createdAt: now });
    for (const [index, item] of listFromJson(source.requirements).entries()) items.push({ id: `reused-requirement-${index}-${crypto.randomUUID()}`, nodeId: "requirements", label: item.label, note: item.note, status: "reused-draft", createdAt: now });
    workspace = { ...workspace, items, version: workspace.version + 1, updatedAt: now };

    // The copied request type is intentionally NOT marked complete. The next
    // screen asks the issuer to review/confirm that the old type still fits
    // the new need before the new RFx proceeds.
    for (const nodeId of ["need", "starting-point"]) workspace = completeWorkspaceNode(workspace, nodeId);
    if (sourceScope) workspace = completeWorkspaceNode(workspace, "scope");
    if (items.some((item) => item.nodeId === "deliverables")) workspace = completeWorkspaceNode(workspace, "deliverables");
    if (items.some((item) => item.nodeId === "requirements")) workspace = completeWorkspaceNode(workspace, "requirements");
    if (responseInstructions) workspace = completeWorkspaceNode(workspace, "response-instructions");
    workspace = { ...workspace, activePath: ["create", "define-need", "select-rfx-type"], version: workspace.version + 1, updatedAt: now };

    const saved = await savePostgresRfxWorkspace(workspace, actor);
    return NextResponse.json({ workspace: saved, persistence: "postgres", source: publicRecord(source), copied: { dates: false, lifecycle: false, responses: false, acknowledgements: false, awardState: false } });
  } catch (error) {
    return errorResponse(error);
  }
}
