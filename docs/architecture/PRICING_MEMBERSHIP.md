# Pricing / Membership — hierarchy and production services

## Review result

The first Pricing / Membership implementation established `/founding`, the organization-level Founding Membership concept, the 250-organization capacity rule, the $49/month offer, the credit-policy contract, and a handoff into `/onboarding/membership`.

The review found five material gaps:

1. the registration source hierarchy was flattened; Membership Selection, Stripe Payment, and Registration Complete were not represented as a nested navigable workflow,
2. the Menu source's Billing & Membership children and grandchildren did not have Membership-owned service destinations,
3. `/onboarding/membership` stopped at a disabled "integration pending" button,
4. the catalog and Founding capacity were deterministic reference data rather than Stripe + RFxchange repository truth,
5. Stripe Checkout, webhook reconciliation, organization billing history, Customer Portal, and capacity reservation were documented seams rather than application services.

This follow-on resolves those gaps without adding unsupported plan types or turning Billing into another Exchange lens.

## Source-derived hierarchy

### Registration Steps 9–11

```text
Registration membership path
├── 9. Membership Selection
│   ├── Founding Membership ($49/mo)
│   └── Future plans as available
├── 10. Payment (Stripe)
│   ├── Enter payment details
│   ├── Secure checkout
│   └── Payment confirmation
└── 11. Registration Complete
    ├── Account activated
    ├── Organization profile created
    ├── Dashboard / Exchange access
    └── Welcome / Onboarding tips
```

The repository represents the three major stages with real routes:

- `/onboarding/membership`
- `/onboarding/membership/payment`
- `/onboarding/membership/complete`

The bullet children are represented in the nested workflow state and on the corresponding stage surface. No additional registration stages were invented.

### Menu > Billing & Membership

```text
Billing & Membership
├── Current Plan
├── Change Plan
│   ├── Compare Plans
│   ├── Select Plan
│   ├── Review Changes
│   └── Confirm
├── Payment Methods
├── Credits
├── Invoices
│   ├── Invoice History
│   ├── Download PDF
│   └── Payment Status
├── Payment History
└── Membership Lifecycle
```

`lib/membership/navigation.ts` is the Membership-owned source of this exact subtree. It gives the hierarchical Menu work a concrete service destination for every source node.

The implementation does **not** invent another paid plan merely to make Change Plan look active. `Compare Plans` reads the live catalog. Select / Review / Confirm are real server operations, but they return a governed conflict when no alternate live plan exists.

## Public Pricing / Membership hierarchy

The public `/founding` page retains the original Pricing / Membership sections already established for this slice:

- Membership offer
- Availability
- Credits
- How membership works
- FAQ

These are in-page acquisition destinations, not new platform applications. The page now reads live Stripe price data and RFxchange capacity data. If those services are not available, the paid CTA is withheld rather than replaced with a fake success path.

## Production membership service

The production application boundary is now:

```text
Public / Onboarding / Menu UI
           │
           ▼
Membership API routes
           │
           ▼
Membership application service
      ┌────┴──────────────┐
      ▼                   ▼
Stripe Billing        PostgreSQL
      │                   │
Hosted Checkout       organization membership truth
Customer Portal       capacity reservation
Invoices              lifecycle / invoice / payment mirror
Webhooks              credit ledger
```

### Stripe

The Stripe adapter uses the configured secret key and the plan lookup key `rfxchange_founding_monthly` by default. It reads the actual recurring Price instead of using the old deterministic catalog value.

Hosted Checkout Sessions are created in `subscription` mode. Payment methods are not hard-coded. The Checkout Session and resulting Subscription receive RFxchange organization, user, membership, and capacity-reservation metadata. Raw card details never pass through RFxchange.

Stripe success is not treated as a browser-only entitlement signal. The webhook endpoint verifies the Stripe signature and reconciles:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

`invoice.paid` and a server-retrieved paid Checkout Session can activate the commercial membership. Webhook events are idempotently recorded in `stripe_webhook_events`.

### RFxchange persistence

`db/membership-runtime.sql` upgrades the existing Membership schema with:

- Stripe Price lookup key,
- Checkout Session references,
- invoice-linked payment history,
- webhook idempotency/audit records,
- indexes supporting capacity and reconciliation.

Founding capacity is reserved transactionally while the plan row is locked. Expired reservations are released. Historical organizations with `activated_at` count toward the first-250 designation even if they later cancel, preserving the meaning of "first 250 organizations."

### Organization context

Checkout and authenticated Billing APIs do not trust organization IDs supplied in request JSON or query parameters.

Membership now consumes the same signed `rfx_session` established by the canonical Identity & Onboarding flow after a verified person is connected to an organization. `lib/membership/context.ts` translates that signed active-organization session into the Membership actor contract; it does not mint a second Membership-specific identity cookie or use a second signing secret.

Every protected Membership operation then revalidates the signed user/organization pair against the canonical `organization_memberships` table before reading billing data, reserving Founding capacity, creating Stripe Checkout, opening the Customer Portal, or confirming returned Checkout state.

This keeps authentication authority in one platform session while preserving Membership's server-side authorization boundary.

## API map

### Public

- `GET /api/membership/catalog` — live Stripe + PostgreSQL catalog/capacity

### Registration payment

- `POST /api/membership/checkout` — validate actor, reserve capacity, create Stripe Checkout Session
- `POST /api/membership/webhooks/stripe` — verify and reconcile Stripe events

### Authenticated Menu > Billing & Membership

- `GET /api/membership/account/current`
- `GET /api/membership/account/credits`
- `GET /api/membership/account/invoices`
- `GET /api/membership/account/payments`
- `GET /api/membership/account/lifecycle`
- `GET /api/membership/invoices/{invoiceId}/pdf`
- `POST /api/membership/portal`
- `POST /api/membership/change-plan/select`
- `POST /api/membership/change-plan/review`
- `POST /api/membership/change-plan/confirm`

The Menu remains the presentation owner. Membership owns the commercial services behind the Menu subtree.

## Credits

Credits remain an RFxchange organization ledger, not Stripe usage billing:

- 1 credit = $1,
- issued credits expire after 12 months,
- ledger entries preserve issuance, consumption, adjustment, reversal, and expiration history.

The account endpoint reads the real ledger. It does not manufacture a client-side credit balance.

## GitHub Pages boundary

GitHub Pages is static and cannot execute Stripe, PostgreSQL, authenticated organization sessions, or webhooks. The Pages workflow therefore runs `scripts/prepare-membership-preview.mjs` after the existing platform and onboarding preview projections. The replacement pages are explicitly labeled static previews and never report live capacity, create checkout sessions, or claim membership activation.

The production source remains server-capable and is typechecked before the preview projection is applied.

## Required runtime configuration

See `.env.example`:

- `DATABASE_URL`
- `RFXCHANGE_SESSION_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- optional `RFXCHANGE_FOUNDING_PRICE_LOOKUP_KEY`

The configured Stripe account must contain the RFxchange Founding organization product/price keyed as `rfxchange_founding_monthly`; runtime mode follows the configured Stripe secret key rather than hard-coded live/test IDs.

## Remaining platform-owned integration

The Membership module is no longer a mocked service. Deployment still must apply the PostgreSQL membership schema/runtime migration, configure the canonical RFxchange organization session secret, and provide Stripe runtime secrets/webhook delivery.

Identity and Organization Selection remain the owners of participant identity and active-organization resolution. Membership consumes that authority and revalidates it; it does not create a competing identity system.
