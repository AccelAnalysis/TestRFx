import { NextResponse } from "next/server";
import { isMembershipPlanCode } from "@/lib/membership/contracts";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { beginMembershipCheckout } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = membershipActorFromRequest(request);
    const body = (await request.json()) as { planCode?: unknown };
    if (!isMembershipPlanCode(body.planCode)) {
      return NextResponse.json({ error: "MEMBERSHIP_PLAN_INVALID", message: "Choose a valid membership plan." }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const result = await beginMembershipCheckout({ actor, planCode: body.planCode, origin });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
