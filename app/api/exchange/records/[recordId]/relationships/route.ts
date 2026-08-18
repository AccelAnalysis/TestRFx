import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange-actor";
import { getExchangeRecord } from "@/lib/server/exchange-record-repository";
import { projectRelationshipStates, setRecordRelationship, type DurableRelationshipKind } from "@/lib/server/record-relationships";
import { DatabaseUnavailableError } from "@/lib/server/database";

const relationshipKinds = new Set<DurableRelationshipKind>(["saved", "watching", "tracking", "following"]);

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const { recordId } = await params;
    const body = await request.json().catch(() => null) as { kind?: string; active?: boolean } | null;
    if (!body?.kind || !relationshipKinds.has(body.kind as DurableRelationshipKind) || typeof body.active !== "boolean") {
      return NextResponse.json({ error: "kind and active are required." }, { status: 400 });
    }
    const record = await getExchangeRecord(recordId, actor);
    if (!record) return NextResponse.json({ error: "Record not found." }, { status: 404 });
    const relationships = await setRecordRelationship(actor, record, body.kind as DurableRelationshipKind, body.active);
    return NextResponse.json({ recordId, relationships: projectRelationshipStates(relationships), saved: relationships.includes("saved") });
  } catch (error) {
    if (error instanceof DatabaseUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Relationship update failed." }, { status: 400 });
  }
}
