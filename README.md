# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The purpose of this repository is to prove the operating chassis while connecting product areas through governed contracts instead of separate applications.

## What is implemented

- Public/acquisition Marketing shell with campaign bar, narrative journey, shared public chrome, audience pages, Founding Membership, footer, and public bottom-matter destinations
- Acquisition-context capture and query carryover into `/join` and `/signin`
- Source-backed recursive Login / Register Entry hierarchy under `/auth/...` with breadcrumbs, parent navigation, browser history, and concrete downstream workflow handoffs
- Identity Login with configured provider-backed magic-link request, callback verification, optional MFA state, HttpOnly session handoff, source-defined recovery outcomes, and readiness routing
- Provider-backed Registration boundary that requires a real provider registration ID before Account Verification handoff
- Provider-backed Account Verification request/resend/change-email/verify boundary with no local reference verification links
- Identity & Onboarding modules for account verification, organization selection/creation, geography, organization profile, capability enrichment, membership, and Exchange-ready completion
- Stripe-hosted Founding Membership subscription checkout with server-side Price validation, organization/session checks, 250-organization cap protection, Checkout confirmation, signed webhook verification, and membership-entitlement event handoff
- Persistent authenticated Exchange composition
- Provider-neutral full-screen reference map canvas
- Translucent universal search and floating controls
- Three-state bottom result drawer with pointer drag and non-gesture controls
- Four governed lens action positions with progressive availability
- Shared Zillow-style record card framework
- Marker-to-card and card-to-marker selection synchronization
- Shared detail surface with exact in-memory state continuity
- Deep-linkable lens and record routes
- Persistent RFx / Resources / Intelligence / Capabilities / Menu bottom navigation
- Cross-lens Menu utility surface
- Seeded records including owned, external, located, and off-map examples
- Normalized Exchange API boundary
- PostgreSQL/PostGIS reference schema
- Responsive desktop composition and mobile safe-area support
- Reduced-motion and keyboard-accessible control paths

## Architecture

RFxchange is organized as three shells: Public / Acquisition, Identity & Onboarding, and the Authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are **lenses over one Exchange**, not separate applications. Menu is a utility surface.

- [`docs/architecture/PLATFORM_SHELL.md`](docs/architecture/PLATFORM_SHELL.md) — authenticated operating chassis
- [`docs/architecture/MARKETING_SHELL.md`](docs/architecture/MARKETING_SHELL.md) — Public / Acquisition → Marketing structure and handoff contract
- [`docs/architecture/AUTH_ENTRY.md`](docs/architecture/AUTH_ENTRY.md) — Public / Acquisition → Login / Register Entry hierarchy and service boundaries
- [`docs/architecture/ACCOUNT_VERIFICATION.md`](docs/architecture/ACCOUNT_VERIFICATION.md) — Account Verification workflow
- [`docs/architecture/ORGANIZATION_SELECTION_CREATION.md`](docs/architecture/ORGANIZATION_SELECTION_CREATION.md) — canonical organization resolution
- [`docs/architecture/GEOGRAPHY_ONBOARDING.md`](docs/architecture/GEOGRAPHY_ONBOARDING.md) — onboarding geography and map placement
- [`docs/architecture/CAPABILITY_ENRICHMENT.md`](docs/architecture/CAPABILITY_ENRICHMENT.md) — AMACS-aligned enrichment boundary
- [`docs/architecture/EXCHANGE_READY_COMPLETION.md`](docs/architecture/EXCHANGE_READY_COMPLETION.md) — readiness and final Exchange handoff

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing, `http://localhost:3000/auth` for the Login / Register hierarchy, or `http://localhost:3000/exchange/rfx` for the Exchange chassis.

## Runtime service configuration

The application no longer simulates successful Login, Registration, Account Verification, or Founding Membership payment. Those boundaries fail closed until their real provider endpoints/credentials are configured.

Identity:

```text
RFXCHANGE_PUBLIC_ORIGIN
RFXCHANGE_IDENTITY_MAGIC_LINK_ENDPOINT
RFXCHANGE_IDENTITY_MAGIC_LINK_VERIFY_ENDPOINT
RFXCHANGE_IDENTITY_MAGIC_LINK_TOKEN          optional
RFXCHANGE_IDENTITY_SESSION_ENDPOINT
RFXCHANGE_IDENTITY_SESSION_TOKEN             optional
RFXCHANGE_IDENTITY_REGISTRATION_ENDPOINT
RFXCHANGE_IDENTITY_REGISTRATION_TOKEN        optional
RFXCHANGE_IDENTITY_VERIFICATION_ENDPOINT
RFXCHANGE_IDENTITY_VERIFICATION_TOKEN        optional
```

Founding Membership / Stripe:

```text
RFXCHANGE_STRIPE_RESTRICTED_KEY               preferred
STRIPE_SECRET_KEY                             fallback
RFXCHANGE_STRIPE_FOUNDING_PRICE_ID            optional explicit environment Price
RFXCHANGE_STRIPE_FOUNDING_LOOKUP_KEY           optional; defaults to rfxchange_founding_monthly
RFXCHANGE_STRIPE_WEBHOOK_SECRET
RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT
RFXCHANGE_MEMBERSHIP_EVENT_TOKEN              optional
```

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches.

## Intentional boundaries

The chassis still does **not** claim production completion for provider infrastructure that is not configured, invitation validation/acceptance/role assignment, durable acquisition analytics, final legal-policy content, RFx response/team workflows, AMACS evidence services, resource transactions, Intelligence datasets, cross-lens referral commerce, notification delivery, or real map tiles.

Where an external production service is required, the code now exposes an explicit provider contract and unavailable state instead of a mocked success. The supplied Login/Register hierarchy is source-bounded: unsupported child workflows are not invented.
