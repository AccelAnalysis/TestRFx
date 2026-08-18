import { NextRequest, NextResponse } from "next/server";
import {
  getOnboardingDetailDefinition,
  listOnboardingDetailDefinitions,
} from "@/lib/onboarding/detail-surface";

export function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject");
  if (!subject) {
    return NextResponse.json({
      contract: "identity-onboarding-detail-surface/v1",
      persistence: "domain-owned",
      subjects: listOnboardingDetailDefinitions().map(({ subject: id, title, mode, required, status }) => ({ id, title, mode, required, status })),
    });
  }

  const definition = getOnboardingDetailDefinition(subject);
  if (!definition) {
    return NextResponse.json({ error: "Unknown onboarding detail subject." }, { status: 404 });
  }

  return NextResponse.json({
    contract: "identity-onboarding-detail-surface/v1",
    persistence: "domain-owned",
    definition,
  });
}
