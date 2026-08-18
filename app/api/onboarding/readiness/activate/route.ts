import { NextRequest, NextResponse } from "next/server";
import {
  createReferenceExchangeActivation,
  getReferenceExchangeReadiness,
} from "@/lib/onboarding/readiness";

interface ActivationRequestBody {
  returnTo?: unknown;
}

export async function POST(request: NextRequest) {
  let body: ActivationRequestBody = {};

  try {
    body = (await request.json()) as ActivationRequestBody;
  } catch {
    body = {};
  }

  const readiness = getReferenceExchangeReadiness();

  if (!readiness.exchangeAccessAllowed) {
    return NextResponse.json(
      {
        error: "Exchange activation is blocked until required readiness items are complete.",
        readiness,
      },
      { status: 409 },
    );
  }

  const requestedDestination = typeof body.returnTo === "string" ? body.returnTo : undefined;
  const activation = createReferenceExchangeActivation(readiness, requestedDestination);

  return NextResponse.json({
    mode: "reference",
    activation,
    readiness,
    persistenceBoundary:
      "Production activation must persist publication/readiness state, entitlements, map/off-map presence, indexing work, and audit/activity events before returning success.",
  });
}
