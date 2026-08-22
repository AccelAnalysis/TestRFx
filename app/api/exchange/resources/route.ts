import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { parseResourceDraft } from "@/lib/server/exchange/resource-input";
import { resourceErrorResponse } from "@/lib/server/exchange/resource-http";
import { createResourceOffer, listResourceRecords } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const records = await listResourceRecords(actor);
    return NextResponse.json({ records, persistence: "postgresql", actorOrganizationId: actor.organizationId });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await resolveExchangeActor(request);
    const draft = parseResourceDraft(await request.json().catch(() => null));
    const record = await createResourceOffer(actor, draft);
    return NextResponse.json({ record, persistence: "postgresql" }, { status: 201 });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
