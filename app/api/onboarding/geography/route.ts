import { NextRequest, NextResponse } from "next/server";
import { buildGeographyContext, validateGeographyDraft } from "@/lib/onboarding/geography";
import { mergeOnboardingProgress } from "@/lib/onboarding/progress";
import {
  readOnboardingProgressFromRequest,
  writeOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

export async function POST(request: NextRequest) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ errors: ["A valid JSON geography payload is required."] }, { status: 400 });
  }

  const validation = validateGeographyDraft(payload);
  if (!validation.ok) return NextResponse.json({ errors: validation.errors }, { status: 422 });

  const context = buildGeographyContext(validation.draft);
  const progress = mergeOnboardingProgress(readOnboardingProgressFromRequest(request), {
    checkpoints: [
      {
        id: "geography",
        status: "complete",
        value: `${context.primaryGeography.name}, ${context.primaryGeography.stateCode}`,
      },
    ],
    context: {
      geography: `${context.primaryGeography.name}, ${context.primaryGeography.stateCode}`,
      mapPresence: "off_map",
    },
  });

  const response = NextResponse.json({ context, progressSaved: true });
  writeOnboardingProgressCookie(response, progress);
  return response;
}
