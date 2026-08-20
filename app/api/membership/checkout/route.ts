import { NextResponse } from "next/server";
import { isMembershipPlanCode, MembershipServiceError } from "@/lib/membership/contracts";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { getCurrentMembership } from "@/lib/membership/repository";
import { beginMembershipCheckout } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = membershipActorFromRequest(request);
    const body = (await request.json()) as { planCode?: unknown };
    if (!isMembershipPlanCode(body.planCode)) {
      return NextResponse.json({ error: "MEMBERSHIP_PLAN_INVALID", message: "Choose a valid membership plan." }, { status: 400 });
    }

    const current = await getCurrentMembership(actor.organizationId);
    if (current?.status === "active") {
      throw new MembershipServiceError(
        "MEMBERSHIP_ALREADY_ACTIVE",
        "This organization already has an active membership. Manage it from Billing & Membership.",
        409,
      );
    }
    if (current?.status === "past_due") {
      throw new MembershipServiceError(
        "MEMBERSHIP_PAYMENT_RECOVERY_REQUIRED",
        "This organization's membership requires billing recovery. Use Billing & Membership instead of creating another subscription.",
        409,
      );
    }

    const origin = new URL(request.url).origin;
    const result = await beginMembershipCheckout({ actor, planCode: body.planCode, origin });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
