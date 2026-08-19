import { NextResponse } from "next/server";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { readMembershipAccountSection } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ section: string }> }) {
  try {
    const actor = membershipActorFromRequest(request);
    const { section } = await context.params;
    return NextResponse.json(await readMembershipAccountSection(actor, section), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
