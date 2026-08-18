import { NextResponse } from "next/server";
import { getPublicMembershipCatalog } from "@/lib/membership/catalog";

export async function GET() {
  return NextResponse.json(getPublicMembershipCatalog(), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
