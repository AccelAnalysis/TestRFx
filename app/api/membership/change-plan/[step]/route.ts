import { NextResponse } from "next/server";
import { isMembershipPlanCode } from "@/lib/membership/contracts";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { confirmPlanChange, reviewPlanChange } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ step: string }> }) {
  try {
    const actor = membershipActorFromRequest(request);
    const { step } = await context.params;
    const body = (await request.json()) as { planCode?: unknown };
    if (!isMembershipPlanCode(body.planCode)) {
      return NextResponse.json({ error: "MEMBERSHIP_PLAN_INVALID", message: "Choose a valid live membership plan." }, { status: 400 });
    }

    if (step === "select" || step === "review") {
      return NextResponse.json(await reviewPlanChange(actor, body.planCode), { headers: { "Cache-Control": "no-store" } });
    }
    if (step === "confirm") {
      return NextResponse.json(await confirmPlanChange(actor, body.planCode), { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "MEMBERSHIP_PLAN_CHANGE_STEP_NOT_FOUND" }, { status: 404 });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
