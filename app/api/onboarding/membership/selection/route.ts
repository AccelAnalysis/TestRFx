import { NextRequest, NextResponse } from "next/server";
import { mergeOnboardingProgress } from "@/lib/onboarding/progress";
import {
  readOnboardingProgressFromRequest,
  writeOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

interface MembershipSelectionBody {
  plan?: unknown;
}

export async function POST(request: NextRequest) {
  let body: MembershipSelectionBody;
  try {
    body = (await request.json()) as MembershipSelectionBody;
  } catch {
    return NextResponse.json({ error: "A valid participation selection is required." }, { status: 400 });
  }

  if (body.plan === "founding") {
    return NextResponse.json(
      {
        error: "Founding Membership cannot be activated until secure Stripe checkout and payment confirmation are connected. Choose Free participation to continue without purchasing a membership.",
      },
      { status: 503 },
    );
  }

  if (body.plan !== "free") {
    return NextResponse.json({ error: "Unsupported participation plan." }, { status: 422 });
  }

  const progress = mergeOnboardingProgress(readOnboardingProgressFromRequest(request), {
    checkpoints: [
      { id: "entitlement", status: "complete", value: "Free organization participation" },
    ],
    context: {
      entitlementSummary: "Free organization participation",
    },
  });

  const response = NextResponse.json({
    ok: true,
    plan: "free",
    entitlement: "active",
    nextPath: "/onboarding/completion",
  });
  writeOnboardingProgressCookie(response, progress);
  return response;
}
