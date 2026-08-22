import type { NextRequest } from "next/server";
import {
  OnboardingForbiddenError,
  OnboardingUnauthorizedError,
  resolveOnboardingActor,
  type OnboardingActor,
} from "@/lib/server/onboarding/actor";

/**
 * Shared Exchange actor adapter. Identity/session authority remains owned by the
 * platform Identity boundary; Exchange domains consume that authority instead of
 * issuing their own sessions or trusting browser-supplied actor identifiers.
 */
export type ExchangeServerActor = OnboardingActor;

export { OnboardingForbiddenError as ExchangeForbiddenError, OnboardingUnauthorizedError as ExchangeUnauthorizedError };

export async function resolveExchangeActor(request: NextRequest): Promise<ExchangeServerActor> {
  return resolveOnboardingActor(request);
}

export function actorCanMutateOwnedExchangeRecords(actor: ExchangeServerActor) {
  return actor.role === "owner"
    || actor.role === "admin"
    || actor.permissions.includes("exchange:write")
    || actor.permissions.includes("resources:write")
    || actor.permissions.includes("capabilities:write")
    || actor.permissions.includes("intelligence:write");
}

export function assertExchangeWrite(actor: ExchangeServerActor, permission?: string) {
  if (actor.role === "owner" || actor.role === "admin" || actor.permissions.includes("exchange:write") || (permission && actor.permissions.includes(permission))) return;
  throw new OnboardingForbiddenError("The active organization role is not authorized to modify this Exchange record.");
}
