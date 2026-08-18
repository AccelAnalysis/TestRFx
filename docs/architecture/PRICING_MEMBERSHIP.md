# Public Pricing / Membership integration

## Purpose

Pricing / Membership is a Public / Acquisition Shell surface that explains the current commercial offer and captures membership intent without becoming a second billing application.

This module is intentionally stacked on the Marketing shell because Marketing owns the public chrome and the canonical `/founding` destination. It does not take ownership of Login, Registration, or the main Onboarding route; those sibling modules consume the membership context through their shared acquisition/auth-entry contracts.

The governing lifecycle is:

```text
Public offer
  -> membership context
  -> Identity / Registration
  -> geography + organization + location
  -> membership selection
  -> Stripe payment integration
  -> organization membership activation
  -> authenticated Menu > Billing & Membership
```

## Current public offer

The reference catalog exposes one paid plan:

- Founding Membership
- $49/month
- organization-level membership
- capped at 250 organizations

The public page is `/founding`. It deliberately separates `Join Free` from `Founding Membership`: creating an RFxchange identity and purchasing an organization membership are different decisions.

## Shell ownership

### Public / Acquisition Shell owns

- `/founding` presentation inside the shared Marketing chrome/footer
- public plan catalog
- price, capacity rule, membership explanation, and FAQs
- Join Free / Sign In / Founding Membership calls to action
- membership-context handoff into the shared public auth gateway

### Identity & Onboarding owns

- verified person
- geography
- organization selection / creation
- organization details and location
- active-organization resolution
- honoring the membership return destination after the organization context exists

This PR does not overwrite the Login, Registration, or main Onboarding pages owned by sibling Public/Auth/Identity PRs.

### Membership service owns

- plan catalog and versions
- organization membership lifecycle
- capacity reservation and activation
- entitlements
- billing references and Stripe reconciliation
- credits ledger
- membership lifecycle events

### Stripe owns

- secure checkout and payment processing
- payment method collection
- subscription/payment/invoice events

Stripe success must be reconciled server-side before RFxchange changes membership truth or unlocks paid entitlements.

### Authenticated Exchange Menu owns

Ongoing servicing belongs in `Menu > Billing & Membership`, including current plan, plan changes, payment methods, credits, invoices, payment history, and membership lifecycle.

## Membership context handoff

The public Founding Membership CTA uses the shared public auth-entry vocabulary:

```text
/join?membership=founding&returnTo=/onboarding/membership?membership=founding
```

The Marketing `/join` gateway preserves query context into Identity. The sibling Auth Entry / Registration / Onboarding modules are responsible for carrying the same context across their own boundaries and honoring the sanitized return destination.

Membership context is not proof of entitlement. It only preserves the visitor's commercial decision while identity and organization context are established.

## Progressive availability

`/onboarding/membership` is the Pricing/Membership integration surface after organization setup. It intentionally displays Stripe checkout as unavailable in this reference slice.

This follows the operating-chassis progressive-availability rule: the integration position is visible, but the UI does not pretend a workflow is operational before authenticated organization context, billing authorization, live capacity reservation, Stripe checkout, and webhook reconciliation exist.

## Domain contracts

`lib/membership/contracts.ts` defines the Pricing/Membership vocabulary for plan codes, money, capacity, public catalog snapshots, credit policy, the membership-selection route, and the public Join gateway handoff.

`lib/membership/catalog.ts` is the deterministic reference catalog. Production should replace live availability with a membership repository/service while retaining the public contract.

`GET /api/membership/catalog` exposes the public catalog boundary. It is intentionally `no-store` because production capacity state can change.

## Persistence target

`db/membership.sql` extends the chassis PostgreSQL model with:

- `membership_plans`
- `organization_plan_memberships`
- `membership_lifecycle_events`
- `membership_capacity_reservations`
- `billing_accounts`
- `billing_invoices`
- `billing_payments`
- `credit_accounts`
- `credit_ledger_entries`

This intentionally distinguishes user-to-organization membership (`organization_memberships` in the chassis schema) from the organization's commercial RFxchange plan (`organization_plan_memberships`).

## Credit policy

The reference contract establishes:

- 1 credit = $1
- organization-level ledger ownership
- issued credits expire after 12 months

The ledger model is used instead of a mutable `credit_balance` field so issuance, consumption, adjustment, reversal, and expiration remain explainable and auditable.

## Parallel PR integration

This slice is designed to compose with the parallel shell work rather than edit the same files:

- Marketing owns shared public chrome/footer and the `/founding` route seed; this module upgrades that route.
- Login / Register Entry owns the `membership` and `returnTo` acquisition-context vocabulary.
- Registration owns person-level identity establishment and should preserve acquisition context downstream.
- Onboarding owns organization/geography/profile readiness and should honor the membership return destination only after the necessary organization context exists.

The Pricing/Membership PR therefore avoids edits to `app/page.tsx`, `app/login/page.tsx`, `app/register/page.tsx`, and `app/onboarding/page.tsx`.

## Production integration points

The next membership implementation can plug into this slice without redesigning the public page:

1. authenticated active-organization resolution
2. server-side billing authorization
3. live Founding Membership capacity query and atomic reservation
4. Stripe Customer / Price / Checkout Session creation
5. webhook verification and idempotent reconciliation
6. entitlement assignment after verified activation
7. authenticated Billing & Membership Menu surfaces
8. invoice/payment retrieval
9. persistent credit ledger operations
10. acquisition attribution persistence

The public page should continue to consume governed membership data rather than hard-coding a separate marketing definition of the plan.
