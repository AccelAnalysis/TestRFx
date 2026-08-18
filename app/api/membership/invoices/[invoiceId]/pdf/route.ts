import { NextResponse } from "next/server";
import { membershipActorFromRequest, membershipErrorResponse } from "@/lib/membership/http";
import { resolveInvoicePdf } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  try {
    const actor = membershipActorFromRequest(request);
    const { invoiceId } = await context.params;
    const url = await resolveInvoicePdf(actor, invoiceId);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
