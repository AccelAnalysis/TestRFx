import { NextResponse } from "next/server";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { openMembershipPortal } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = membershipActorFromRequest(request);
    const origin = new URL(request.url).origin;
    const result = await openMembershipPortal({ actor, returnUrl: `${origin}/exchange/rfx` });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
