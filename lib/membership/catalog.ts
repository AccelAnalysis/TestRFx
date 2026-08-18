import type { MembershipCatalogSnapshot, MembershipPlan } from "@/lib/membership/contracts";

export const foundingMembership: MembershipPlan = {
  code: "founding",
  name: "Founding Membership",
  description: "Organization-level RFxchange membership for the first 250 participating organizations.",
  price: { currency: "USD", cents: 4900 },
  billingInterval: "month",
  organizationLevel: true,
  capacity: {
    limit: 250,
    consumed: null,
    state: "open",
  },
  foundingDesignation: true,
};

export const creditPolicy = {
  usdValuePerCredit: 1,
  expirationMonths: 12,
  ledgerOwner: "organization",
} as const;

export function getPublicMembershipCatalog(): MembershipCatalogSnapshot {
  return {
    plans: [foundingMembership],
    creditPolicy,
    generatedAt: new Date().toISOString(),
  };
}

export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
