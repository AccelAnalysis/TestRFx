import { NextRequest, NextResponse } from "next/server";
import { sanitizeOnboardingProgressUpdate } from "@/lib/onboarding/progress";
import {
  applyOnboardingProgressUpdate,
  readOnboardingProgressFromRequest,
} from "@/lib/onboarding/progress-store";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { progress: readOnboardingProgressFromRequest(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid onboarding progress payload is required." }, { status: 400 });
  }

  const update = sanitizeOnboardingProgressUpdate(payload);
  if (!update || (!update.checkpoints?.length && !update.context)) {
    return NextResponse.json({ error: "No supported onboarding progress updates were supplied." }, { status: 422 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  const progress = applyOnboardingProgressUpdate(request, response, update);
  return NextResponse.json(
    { ok: true, progress },
    {
      status: 200,
      headers: response.headers,
    },
  );
}
