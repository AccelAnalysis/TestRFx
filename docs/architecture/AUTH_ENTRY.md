# Public Login / Register Entry

The Public / Acquisition Shell owns the gateway into RFxchange identity. It does not own downstream organization or Exchange business logic.

This boundary exists so Marketing, campaign landing pages, referral links, partner invitations, QR/event entry, mobile launch, notifications, direct URLs, and protected-record deep links can enter the same Identity & Onboarding Shell without losing why the visitor arrived.

## Governing rule

Explicit intent stays explicit:

```text
Sign In CTA  -> /signin -> /login
Join CTA     -> /join   -> /register
Unknown path -> /auth   -> source-backed workflow navigator
```

A visitor who selected Sign In is not forced through a second Login/Register chooser. A visitor who selected Join is not forced through an extra chooser. `/auth` is the inspectable hierarchy and the neutral entry surface for sources that genuinely do not know the intended identity action.

## True hierarchical navigation

`/auth` now renders a recursive, URL-backed tree. Every source-defined child or grandchild has its own path and breadcrumb state.

### Login branch

```text
/auth/sign-in
|
+-- entry-points
|   +-- marketing-site
|   +-- mobile-app
|   +-- magic-link-email
|   +-- direct-url
|   +-- notification-link
|
+-- enter-email
|   +-- continue
|       +-- email-found-system
|           +-- email-not-found
|           |   +-- choose-to-register
|           |       +-- register
|           |       +-- return-marketing
|           |
|           +-- email-found
|               +-- send-sign-in-link
|                   +-- check-email
|                       +-- click-magic-link
|                           +-- link-expired
|                           |   +-- resend-link
|                           |       +-- return-login
|                           |
|                           +-- link-valid
|                               +-- authenticate
|                                   +-- additional-verification-required
|                                       +-- mfa-2fa
|                                       |   +-- verify-code
|                                       |       +-- successful-login
|                                       |           +-- enter-rfxchange
|                                       +-- successful-login
|                                           +-- enter-rfxchange
|
+-- session-states
+-- security-features
+-- magic-link-notes
+-- failed-login-outcomes
+-- error-handling
```

### Registration branch

```text
/auth/register
|
+-- entry-points
|   +-- website-landing-page
|   +-- campaign-referral-link
|   +-- partner-invitation
|   |   +-- validate-invitation
|   |       +-- accept-join-organization
|   |           +-- set-role-confirm-access
|   +-- qr-event
|
+-- choose-action
|   +-- existing-user
|   +-- new-user
|
+-- create-account
|   +-- name
|   +-- email
|   +-- create-password
|
+-- verify-email
|   +-- verification-email-sent
|       +-- click-verification-link
|           +-- email-verified
|               +-- verified
|               +-- not-verified
|                   +-- resend-verification
|                       +-- resend-email
|                       +-- change-email
|
+-- select-geography
|   +-- search-county-city-region
|       +-- initial-locality
|           +-- market-boundaries
|
+-- organization-setup
|   +-- claim-existing
|   +-- create-new
|
+-- organization-details
|   +-- name
|   +-- description
|   +-- industry-naics
|   +-- website-contact
|
+-- location-map-placement
|   +-- physical-address
|       +-- system-geocodes
|           +-- marker-placed-map
|
+-- membership-selection
|   +-- founding-membership
|   +-- future-plans
|
+-- payment
|   +-- enter-payment-details
|       +-- secure-checkout
|           +-- payment-confirmation
|
+-- registration-complete
|   +-- account-activated
|   +-- organization-profile-created
|   +-- dashboard-exchange-access
|   +-- welcome-onboarding-tips
|
+-- supporting-processes
+-- key-outcomes
+-- business-rules
```

The leaf nodes deliberately stop where the supplied Login, Registration, and Onboarding sources stop. The navigator does not create speculative child workflows.

The Registration source explicitly includes `Create Password`, while the merged Login architecture is passwordless. The hierarchy therefore preserves `Create Password` as a source item and documents the conflict; it does not invent a second local credential store. Authentication-method execution remains owned by the configured Identity provider.

## Nested navigation state

The hierarchy uses URL state rather than a private menu-only state machine:

- each source node has a stable `/auth/...` path;
- breadcrumbs navigate to every ancestor;
- Parent Workflow returns one level;
- browser Back/Forward preserves the exact branch;
- supported acquisition context is carried across child routes;
- invalid hierarchy paths return a real 404.

The source data for the tree is centralized in `lib/acquisition/auth-entry-navigation.ts` and `lib/acquisition/auth-entry-navigation-complete.ts`. The presentation is centralized in `components/public/AuthEntryNavigator.tsx`.

## Context contract

`lib/acquisition/auth-entry.ts` carries the public-to-identity handoff context:

```text
returnTo       safe internal destination after identity/readiness
source         acquisition source
campaign       campaign or placement identifier
referral       referral context
invitation     invitation token/context
organization   organization context
membership     membership intent
geography      geographic context
record         requested/deep-linked record
```

Login preserves this context when the user changes course into Registration. Registration preserves it into Account Verification and downstream onboarding.

## Real Login service boundary

The previous local `ReferenceIdentityGateway` has been removed. TestRFx no longer reports that a sign-in link was sent unless a configured Identity provider actually accepts the request.

Runtime integration:

```text
/login
  -> POST /api/auth/login
  -> configured Identity magic-link endpoint
  -> email provider / identity system sends one-time link
  -> callback /login/verify?token=...
  -> POST /api/auth/login/verify
  -> configured Identity verification endpoint
  -> optional MFA challenge
  -> authenticated Identity context
  -> HttpOnly RFxchange session cookie
  -> readiness routing
```

Environment contract:

```text
RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT
RFXCHANGE_IDENTITY_MAGIC_LINK_VERIFY_ENDPOINT
RFXCHANGE_IDENTITY_MAGIC_LINK_TOKEN          optional provider credential
RFXCHANGE_PUBLIC_ORIGIN                      canonical callback origin
RFXCHANGE_IDENTITY_SESSION_ENDPOINT
RFXCHANGE_IDENTITY_SESSION_TOKEN             optional provider credential
```

Production provider endpoints must use HTTPS. If they are not configured, the API returns an unavailable state; it does not simulate delivery, authentication, or a session.

### Source Login outcomes represented

The Login API/flow represents the source outcomes instead of collapsing everything into generic success:

- email not found -> Choose to Register -> Registration or Marketing;
- restricted/deactivated account -> no session;
- rate limited -> no challenge/session;
- sign-in link expired -> Resend Link -> Login;
- invalid/tampered link -> reject;
- MFA required -> MFA / 2FA -> Verify Code;
- provider/network failure -> retry path without fake success;
- successful authentication -> server resolves onboarding/readiness before Enter RFxchange.

The source-defined 15-minute magic-link lifetime remains the default contract when a provider does not return a different positive TTL.

## Real Registration service boundary

The previous local registration adapter manufactured a `reg_*` ID without persisting a real identity. That behavior has been removed.

`POST /api/identity/register` validates the source-facing Registration form and calls a configured registration provider. A verification handoff is returned only after that provider returns a real `registrationId`.

Environment contract:

```text
RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT
RFXCHANGE_IDENTITY_REGISTRATION_TOKEN        optional provider credential
```

No endpoint means no simulated registration success.

## Real Account Verification boundary

The old non-production HMAC reference-link generator has been removed. Account Verification now calls a configured provider for request, resend, change-email, and verify actions.

Environment contract:

```text
RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT
RFXCHANGE_IDENTITY_VERIFICATION_TOKEN        optional provider credential
```

The existing Account Verification UI remains responsible for the source-defined Verification Email Sent → Click Verification Link → Email Verified? path plus Resend Email / Change Email recovery, but it no longer exposes a local “reference verification link.”

## Downstream handoffs use the merged onboarding modules

The Login/Register Entry layer does not duplicate downstream forms. Source nodes route to the actual module that owns the work:

| Source node | Owning RFxchange workflow |
| --- | --- |
| Verify Email | `/onboarding/account-verification` |
| Select Geography / initial locality / market boundaries | `/onboarding/geography` |
| Claim/Create Organization | `/onboarding/organization` |
| Organization Details | `/onboarding/organization-profile` |
| Physical Address / geocoding / map placement | `/onboarding/geography` |
| Membership Selection / Payment | `/onboarding/membership` |
| Registration Complete / Successful Login readiness | `/onboarding/completion` |

Capability enrichment continues in the existing Identity & Onboarding capability module as resolved by the readiness service; it is not duplicated inside the public gateway.

## Invitation / referral truth boundary

The supplied Onboarding source explicitly defines:

```text
Referral / Invitation
  -> Validate Invitation
  -> Accept / Join Organization
  -> Set Role / Confirm Access
```

Those exact children are represented in the public hierarchy. TestRFx does not currently contain a dedicated invitation-validation / role-assignment service, so these nodes are marked `production-pending` and hand off to the real Organization Selection / Creation workflow rather than manufacturing an accepted invitation or role.

That is an intentional incomplete external/domain dependency, not a mocked successful feature.

## Founding Membership and Stripe

The Registration source explicitly includes:

```text
Membership Selection
  -> Founding Membership ($49/mo)
  -> Payment (Stripe)
     -> Enter Payment Details
     -> Secure Checkout
     -> Payment Confirmation
```

The previous disabled “Stripe integration pending” button has been replaced with server-side Stripe Checkout integration. Raw payment details are entered on Stripe-hosted Checkout, not in RFxchange.

Current implementation:

```text
/onboarding/membership
  -> POST /api/membership/checkout
  -> resolve authenticated RFxchange session
  -> require verified account + active organization
  -> atomic Founding capacity reservation
  -> resolve/validate Founding Stripe Price
  -> duplicate/subscription preflight
  -> Stripe-hosted subscription Checkout
  -> /onboarding/membership/complete
  -> server retrieves Checkout Session from Stripe
  -> signed Stripe webhook
       -> capacity service finalizes/releases reservation
       -> membership entitlement service updates business state
  -> readiness completion
```

The Checkout implementation uses the existing Founding Membership catalog contract: $49/month, organization-level, first 250 organizations. The Stripe Price is resolved by environment using `RFXCHANGE_STRIPE_FOUNDING_PRICE_ID` or lookup key `rfxchange_founding_monthly`; the live Price ID is not hard-coded into application source.

The 250-organization limit is not enforced by a racy “count then create” check alone. Checkout requires an atomic reservation from the RFxchange capacity service. That reservation ID is attached to Stripe Checkout and subscription metadata. Signed `checkout.session.completed` / `checkout.session.expired` and subscription lifecycle events are forwarded so the capacity service can finalize or release the reservation idempotently.

Environment contract:

```text
RFXCHANGE_STRIPE_RESTRICTED_KEY               preferred
STRIPE_SECRET_KEY                             fallback
RFXCHANGE_STRIPE_FOUNDING_PRICE_ID            optional explicit environment Price
RFXCHANGE_STRIPE_FOUNDING_LOOKUP_KEY           optional; defaults to rfxchange_founding_monthly
RFXCHANGE_STRIPE_WEBHOOK_SECRET
RFXCHANGE_MEMBERSHIP_CAPACITY_ENDPOINT        atomic reserve/release/finalize service
RFXCHANGE_MEMBERSHIP_CAPACITY_TOKEN           optional provider credential
RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT           entitlement event service
RFXCHANGE_MEMBERSHIP_EVENT_TOKEN              optional provider credential
```

The capacity and entitlement services must process Stripe event IDs idempotently because Stripe retries webhook delivery. The capacity service should also expire abandoned reservations defensively even if a webhook is delayed.

The checkout deliberately does not enable Exchange access from a browser redirect. Stripe session confirmation is checked server-side, and signed webhook events are forwarded to the membership entitlement service, which remains the authoritative business-state integration.

## Static GitHub Pages preview

GitHub Pages cannot execute Next.js API routes. `scripts/prepare-auth-entry-pages-preview.mjs` therefore projects the same hierarchy and clearly labels Login, Registration, verification, and Stripe as runtime-only. It does not restore the old flat chooser, manufacture registration/verification success, or display a fake checkout action.

## Security boundaries

The entry work now fails closed rather than simulating external systems:

- safe internal return destinations are validated;
- production external service endpoints require HTTPS;
- identity sessions use an HttpOnly, SameSite=Lax cookie and Secure in production;
- Stripe Checkout is created server-side;
- raw payment details never enter RFxchange;
- Founding capacity is reserved before Checkout creation;
- Stripe webhook signatures are validated from the raw body and signing secret;
- Stripe Checkout does not hard-code payment method types;
- no automatic tax flag is enabled by this slice because RFxchange tax registrations are not established here;
- server-side readiness still controls which onboarding step or Exchange destination follows authentication.

## Remaining source-defined service gap

The only source-defined actionable branch in this slice that still lacks its own production service is invitation validation / acceptance / role confirmation. Its hierarchy exists, but it is marked pending and routed to Organization Selection / Creation until an invitation service is implemented.

The informational source branches—Magic Link Notes, Session States, Security Features, Failed Login Outcomes, Error Handling, Registration Key Outcomes, Supporting Processes, Business Rules, and source field definitions—are represented as supporting nodes. They are not given invented transactional children when the source does not define them.
