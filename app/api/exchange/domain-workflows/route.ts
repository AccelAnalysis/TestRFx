import { NextRequest, NextResponse } from "next/server";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import { assertPermission, ExchangeAuthenticationRequiredError, resolveServerActor } from "@/lib/server/actor-context";
import { databaseConfigured } from "@/lib/server/postgres";
import {
  addIntelligenceNote,
  archiveResourceOffer,
  createIntelligenceRecord,
  createResourceOffer,
  createResourceRequest,
  ExchangeDomainValidationError,
  updateIntelligenceRecord,
  updateResourceOffer,
} from "@/lib/server/exchange-domain-service";

type RequestBody =
  | { domain: "resources"; action: "offer"; draft: ResourceDraft }
  | { domain: "resources"; action: "edit"; recordId: string; draft: ResourceDraft }
  | { domain: "resources"; action: "request"; recordId: string; draft: ResourceRequestDraft }
  | { domain: "resources"; action: "archive"; recordId: string }
  | { domain: "intelligence"; action: "add"; record: ExchangeRecord }
  | { domain: "intelligence"; action: "edit"; record: ExchangeRecord }
  | { domain: "intelligence"; action: "note"; recordId: string; note: string };

export async function POST(request: NextRequest) {
  if (!databaseConfigured()) return NextResponse.json({ error: "Domain workflow service requires PostgreSQL", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });
  const body = await request.json().catch(() => null) as RequestBody | null;
  if (!body || (body.domain !== "resources" && body.domain !== "intelligence")) return NextResponse.json({ error: "Unsupported domain workflow" }, { status: 400 });

  try {
    const actor = await resolveServerActor(request);
    let result: { recordId: string; message: string };
    if (body.domain === "resources") {
      assertPermission(actor, body.action === "request" ? "resources:request" : "resources:manage");
      if (body.action === "offer") result = await createResourceOffer(actor, body.draft);
      else if (body.action === "edit") result = await updateResourceOffer(actor, body.recordId, body.draft);
      else if (body.action === "request") result = await createResourceRequest(actor, body.recordId, body.draft);
      else result = await archiveResourceOffer(actor, body.recordId);
    } else {
      assertPermission(actor, body.action === "note" ? "intelligence:note" : "intelligence:contribute");
      if (body.action === "add") result = await createIntelligenceRecord(actor, body.record);
      else if (body.action === "edit") result = await updateIntelligenceRecord(actor, body.record);
      else result = await addIntelligenceNote(actor, body.recordId, body.note);
    }
    return NextResponse.json({ accepted: true, durable: true, result, serviceMode: "postgres" }, { status: 200 });
  } catch (error) {
    if (error instanceof ExchangeAuthenticationRequiredError) return NextResponse.json({ error: error.message }, { status: 401 });
    if (error instanceof ExchangeDomainValidationError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error("Exchange domain workflow failed", error);
    return NextResponse.json({ error: "Domain workflow could not be completed" }, { status: 500 });
  }
}
