import { NextRequest, NextResponse } from "next/server";
import {
  loadAuthoritativeReadiness,
  readinessHttpStatus,
} from "@/lib/server/onboarding/readiness-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const readiness = await loadAuthoritativeReadiness(request.headers.get("cookie"));
    return NextResponse.json({ mode: "authoritative", readiness });
  } catch (error) {
    const status = readinessHttpStatus(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Exchange readiness could not be evaluated." },
      { status },
    );
  }
}
