import { NextRequest, NextResponse } from "next/server";
import {
  activateAuthoritativeReadiness,
  readinessHttpStatus,
} from "@/lib/server/onboarding/readiness-service";

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

  try {
    const requestedDestination = typeof body.returnTo === "string" ? body.returnTo : undefined;
    const result = await activateAuthoritativeReadiness(request.headers.get("cookie"), requestedDestination);
    return NextResponse.json({ mode: "authoritative", ...result });
  } catch (error) {
    const status = readinessHttpStatus(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exchange activation could not be completed." },
      { status },
    );
  }
}
