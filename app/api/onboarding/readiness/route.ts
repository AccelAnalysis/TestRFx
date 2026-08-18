import { NextResponse } from "next/server";
import { getReferenceExchangeReadiness } from "@/lib/onboarding/readiness";

export async function GET() {
  return NextResponse.json({
    mode: "reference",
    readiness: getReferenceExchangeReadiness(),
    productionBoundary:
      "Replace the reference evaluator with authenticated identity, organization, geography, capability, visibility, and entitlement repositories without changing the UI contract.",
  });
}
