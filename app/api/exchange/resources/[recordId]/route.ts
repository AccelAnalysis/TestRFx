import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { parseResourceDraft } from "@/lib/server/exchange/resource-input";
import { resourceErrorResponse } from "@/lib/server/exchange/resource-http";
import {
  archiveResourceOffer,
  getResourceRecord,
  updateResourceOffer,
} from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const record = await getResourceRecord(actor, recordId);
    return NextResponse.json({ record, persistence: "postgresql" });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const draft = parseResourceDraft(await request.json().catch(() => null));
    const record = await updateResourceOffer(actor, recordId, draft);
    return NextResponse.json({ record, persistence: "postgresql" });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const archived = await archiveResourceOffer(actor, recordId);
    return NextResponse.json({ ...archived, persistence: "postgresql" });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
