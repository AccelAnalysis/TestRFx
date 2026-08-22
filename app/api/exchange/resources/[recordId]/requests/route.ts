import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { parseResourceRequest } from "@/lib/server/exchange/resource-input";
import { resourceErrorResponse } from "@/lib/server/exchange/resource-http";
import { createResourceRequest } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const input = parseResourceRequest(await request.json().catch(() => null));
    const created = await createResourceRequest(actor, recordId, input);
    return NextResponse.json({ request: created, persistence: "postgresql" }, { status: 201 });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
