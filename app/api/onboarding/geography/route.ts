import { NextRequest, NextResponse } from "next/server";
import { buildGeographyContext, validateGeographyDraft } from "@/lib/onboarding/geography";

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

  return NextResponse.json({
    context,
    persisted: false,
    integration: {
      geocoder: "reference-preview",
      geographyPolicy: "reference-registry",
      persistence: "session-client",
    },
  });
}
