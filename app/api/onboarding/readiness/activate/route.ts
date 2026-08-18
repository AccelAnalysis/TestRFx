import { NextRequest, NextResponse } from "next/server";
import {
  buildExchangeReadiness,
  createExchangeActivation,
} from "@/lib/onboarding/readiness";
import { mergeOnboardingProgress } from "@/lib/onboarding/progress";
import {
  readOnboardingProgressFromRequest,
  writeOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

interface ActivationRequestBody {
  returnTo?: unknown;
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: ActivationRequestBody = {};
  try {
    body = (await request.json()) as ActivationRequestBody;
  } catch {
    body = {};
  }

  const current = readOnboardingProgressFromRequest(request);
  const readiness = buildExchangeReadiness(current);

  if (!readiness.exchangeAccessAllowed) {
    return NextResponse.json(
      {
        error: "Exchange activation is blocked until all required readiness items are complete.",
        readiness,
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const requestedDestination = typeof body.returnTo === "string" ? body.returnTo : undefined;
  const activation = createExchangeActivation(readiness, requestedDestination);
  const progress = mergeOnboardingProgress(current, {
    activation: {
      status: activation.status,
      activatedAt: activation.activatedAt,
      destination: activation.destination,
    },
  });

  const response = NextResponse.json(
    { activation, readiness },
    { headers: { "Cache-Control": "no-store" } },
  );
  writeOnboardingProgressCookie(response, progress);
  return response;
}
