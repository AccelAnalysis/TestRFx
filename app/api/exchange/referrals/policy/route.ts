import { NextRequest, NextResponse } from "next/server";
import { databaseConfigured } from "@/lib/server/postgres";
import { getReferralPolicyForOrganizationName } from "@/lib/server/referral-policy-service";

export async function GET(request: NextRequest) {
  const organization = request.nextUrl.searchParams.get("organization")?.trim();
  if (!organization) return NextResponse.json({ error: "organization is required" }, { status: 400 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Referral policy service requires PostgreSQL", code: "DATABASE_NOT_CONFIGURED" }, { status: 503 });

  try {
    const policy = await getReferralPolicyForOrganizationName(organization);
    if (!policy) return NextResponse.json({ error: "Recipient organization not found" }, { status: 404 });
    return NextResponse.json({ policy });
  } catch (error) {
    console.error("Referral policy lookup failed", error);
    return NextResponse.json({ error: "Referral policy could not be loaded" }, { status: 500 });
  }
}
