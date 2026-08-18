import { NextResponse } from "next/server";
import { getPublicMembershipCatalog } from "@/lib/membership/service";
import { membershipErrorResponse } from "@/lib/membership/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPublicMembershipCatalog(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
