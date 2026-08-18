import { NextResponse } from "next/server";
import { membershipErrorResponse } from "@/lib/membership/http";
import { reconcileStripeWebhook } from "@/lib/membership/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "STRIPE_SIGNATURE_REQUIRED", message: "Missing Stripe signature." }, { status: 400 });
  }
  try {
    const payload = await request.text();
    return NextResponse.json(await reconcileStripeWebhook(payload, signature));
  } catch (error) {
    return membershipErrorResponse(error);
  }
}
