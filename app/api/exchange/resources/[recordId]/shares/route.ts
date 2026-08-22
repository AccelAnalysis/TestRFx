import { NextRequest, NextResponse } from "next/server";
import { resolveExchangeActor } from "@/lib/server/exchange/actor";
import { parseOrganizationShare } from "@/lib/server/exchange/resource-input";
import { resourceErrorResponse } from "@/lib/server/exchange/resource-http";
import { sendResourceToOrganization } from "@/lib/server/exchange/resource-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  try {
    const actor = await resolveExchangeActor(request);
    const { recordId } = await params;
    const input = parseOrganizationShare(await request.json().catch(() => null));
    const share = await sendResourceToOrganization(actor, recordId, input);
    return NextResponse.json({ share, persistence: "postgresql" }, { status: 201 });
  } catch (error) {
    return resourceErrorResponse(error);
  }
}
