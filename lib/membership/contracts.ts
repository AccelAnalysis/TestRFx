export type MembershipPlanCode = "founding";
export type MembershipBillingInterval = "month";
export type MembershipAvailabilityState = "open" | "full";
export type MembershipLifecycleStatus =
  | "selected"
  | "checkout_pending"
  | "active"
  | "past_due"
  | "cancelled"
  | "ended";

export interface MoneyAmount {
  currency: "USD";
  cents: number;
}

export interface MembershipCapacity {
  limit: number;
  consumed: number;
  reserved: number;
  remaining: number;
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
  stripeLookupKey: string;
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
  source: "stripe+postgres";
}

export interface MembershipActorContext {
  userId: string;
  organizationId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface CurrentMembership {
  id: string;
  organizationId: string;
  planCode: MembershipPlanCode;
  planName: string;
  status: MembershipLifecycleStatus;
  selectedAt: string;
  activatedAt: string | null;
  endedAt: string | null;
  stripeSubscriptionId: string | null;
}

export interface MembershipCheckoutResult {
  checkoutSessionId: string;
  url: string;
}

export interface MembershipNavigationNode {
  id: string;
  label: string;
  description: string;
  href?: string;
  destination?: string;
  children?: readonly MembershipNavigationNode[];
}

export class MembershipServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "MembershipServiceError";
  }
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

export function membershipPaymentHref(planCode: MembershipPlanCode): string {
  return `/onboarding/membership/payment?membership=${encodeURIComponent(planCode)}`;
}

export function publicJoinHrefForPlan(planCode: MembershipPlanCode): string {
  const returnTo = membershipSelectionHref(planCode);
  return `/join?membership=${encodeURIComponent(planCode)}&returnTo=${encodeURIComponent(returnTo)}`;
}
