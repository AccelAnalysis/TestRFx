import type { CreditPolicy } from "@/lib/membership/contracts";

export const FOUNDING_PLAN_CODE = "founding" as const;
export const FOUNDING_PRICE_LOOKUP_KEY =
  process.env.RFXCHANGE_FOUNDING_PRICE_LOOKUP_KEY?.trim() || "rfxchange_founding_monthly";

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
