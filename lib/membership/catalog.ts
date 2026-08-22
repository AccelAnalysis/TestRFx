import type { CreditPolicy, MembershipPlan } from "@/lib/membership/contracts";

export const FOUNDING_PLAN_CODE = "founding" as const;
export const FOUNDING_PRICE_LOOKUP_KEY =
  process.env.RFXCHANGE_FOUNDING_PRICE_LOOKUP_KEY?.trim() || "rfxchange_founding_monthly";

/**
 * Static product descriptor used for capacity policy and read-only/static previews.
 * Live pricing/availability is resolved from Stripe + PostgreSQL by the membership service.
 */
export const foundingMembership: MembershipPlan = {
  code: FOUNDING_PLAN_CODE,
  name: "Founding Membership",
  description: "Organization-level RFxchange Founding Membership.",
  price: { currency: "USD", cents: 4900 },
  billingInterval: "month",
  organizationLevel: true,
  capacity: { limit: 250, consumed: 0, reserved: 0, remaining: 250, state: "open" },
  foundingDesignation: true,
  stripeLookupKey: FOUNDING_PRICE_LOOKUP_KEY,
};

export const creditPolicy: CreditPolicy = {
  usdValuePerCredit: 1,
  expirationMonths: 12,
  ledgerOwner: "organization",
};

export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
