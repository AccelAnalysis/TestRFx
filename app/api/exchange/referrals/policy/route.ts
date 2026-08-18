import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/postgres";
import { getReferralPolicyForRecord } from "@/lib/server/referral-policy-service";

export async function GET(request: NextRequest) {
  const recordId = request.nextUrl.searchParams.get("recordId")?.trim();
  if (!recordId) return NextResponse.json({ error: "recordId is required" }, { status: 400 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Referral policy service requires PostgreSQL", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });

  try {
    const policy = await getReferralPolicyForRecord(recordId);
    if (!policy) return NextResponse.json({ error: "Exchange record not found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("Referral policy lookup failed", error);
    return NextResponse.json({ error: "Referral policy could not be loaded" }, { status: 500 });
  }
}
