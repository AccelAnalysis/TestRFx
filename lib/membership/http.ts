import { NextResponse } from "next/server";
import { MembershipServiceError } from "@/lib/membership/contracts";
import { readMembershipContext } from "@/lib/membership/context";

export function membershipActorFromRequest(request: Request) {
  return readMembershipContext(request.headers.get("cookie"));
}

export function membershipErrorResponse(error: unknown) {
  if (error instanceof MembershipServiceError) {
    return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
  }
  console.error("RFxchange membership service error", error);
  return NextResponse.json(
    { error: "MEMBERSHIP_SERVICE_ERROR", message: "The membership service could not complete the request." },
    { status: 500 },
  );
}
