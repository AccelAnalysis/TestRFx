export type MembershipPlanCode = "founding";
export type MembershipBillingInterval = "month";
export type MembershipAvailabilityState = "open" | "closed";

export interface MoneyAmount {
  currency: "USD";
  cents: number;
}

export interface MembershipCapacity {
  limit: number;
  consumed: number | null;
  state: MembershipAvailabilityState;
}

export interface MembershipPlan {
  code: MembershipPlanCode;
  name: string;
  description: string;
  price: MoneyAmount;
  billingInterval: MembershipBillingInterval;
  organizationLevel: true;
  capacity: MembershipCapacity;
  foundingDesignation: boolean;
}

export interface CreditPolicy {
  usdValuePerCredit: number;
  expirationMonths: number;
  ledgerOwner: "organization";
}

export interface MembershipCatalogSnapshot {
  plans: readonly MembershipPlan[];
  creditPolicy: CreditPolicy;
  generatedAt: string;
}

export function isMembershipPlanCode(value: unknown): value is MembershipPlanCode {
  return value === "founding";
}

export function normalizeMembershipSelection(value: string | string[] | undefined): MembershipPlanCode | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  return isMembershipPlanCode(candidate) ? candidate : null;
}

export function membershipSelectionHref(planCode: MembershipPlanCode): string {
  return `/onboarding/membership?membership=${encodeURIComponent(planCode)}`;
}

export function publicJoinHrefForPlan(planCode: MembershipPlanCode): string {
  const returnTo = membershipSelectionHref(planCode);
  return `/join?membership=${encodeURIComponent(planCode)}&returnTo=${encodeURIComponent(returnTo)}`;
}
