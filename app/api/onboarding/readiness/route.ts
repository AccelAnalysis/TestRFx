import { NextRequest, NextResponse } from "next/server";
import { buildExchangeReadiness } from "@/lib/onboarding/readiness";
import { readOnboardingProgressFromRequest } from "@/lib/onboarding/progress-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const progress = readOnboardingProgressFromRequest(request);
  return NextResponse.json(
    { readiness: buildExchangeReadiness(progress), progressUpdatedAt: progress.updatedAt },
    { headers: { "Cache-Control": "no-store" } },
  );
}
