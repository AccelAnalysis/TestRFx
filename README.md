# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The repository proves the operating chassis and the governed integration boundaries downstream product areas use.

## What is implemented

- Public/acquisition Marketing shell with campaign bar, narrative journey, shared public chrome, audience pages, Founding Membership, footer, and public bottom-matter destinations
- Acquisition-context carryover into Registration/Login
- Identity & Onboarding shell modules
- Persistent authenticated Exchange composition
- Provider-neutral persistent map
- Universal search and floating controls
- Three-state results drawer
- Four governed lens-action positions
- Shared record-card and detail frameworks
- RFx / Resources / Intelligence / Capabilities / Menu navigation
- Cross-lens Menu utility overlay
- **Recursive Menu hierarchy with source-defined child and grandchild workflows**
- **Server-authoritative Shared Workflows/Services for Save/Watch/Track/Follow, Share, Referrals, Match, Team, and Connect**
- **PostgreSQL-backed management views for Saved & Watchlist, Referrals, Messages, Notifications, Membership/Billing, organization context, account context, and privacy/data requests**
- Deep-linkable lens and record routes
- PostgreSQL/PostGIS persistence target
- Responsive desktop/mobile composition and accessibility paths
- GitHub Pages preview projection that remains separate from the server-capable operating chassis

## Architecture

RFxchange is organized as three shells: Public / Acquisition, Identity & Onboarding, and the Authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are **lenses over one Exchange**, not separate applications. Menu is a utility surface.

- [`docs/architecture/PLATFORM_SHELL.md`](docs/architecture/PLATFORM_SHELL.md) — authenticated operating chassis
- [`docs/architecture/SHARED_WORKFLOWS_SERVICES.md`](docs/architecture/SHARED_WORKFLOWS_SERVICES.md) — cross-lens hierarchy, real service boundary, runtime persistence, and security contract
- [`docs/architecture/MARKETING_SHELL.md`](docs/architecture/MARKETING_SHELL.md) — Public / Acquisition → Marketing structure and handoff contract

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing or `http://localhost:3000/exchange/rfx` for the Exchange.

Durable Shared Workflows/Services require PostgreSQL and authenticated Exchange context. See `docs/architecture/SHARED_WORKFLOWS_SERVICES.md` for `DATABASE_URL`, identity-bridge variables, and migration order.

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches.

## Intentional external-authority boundaries

Shared workflows no longer report fake durable success. Missing external authorities fail closed.

Production still requires configured providers/services for authenticated session creation and MFA, Stripe-authoritative active subscription/payment-method changes, destructive identity deletion/deactivation, binary object storage, outbound email/push/SMS delivery, and production map tiles.

Lens-specific domain implementations remain owned by their domains; the shared-services layer does not absorb RFx Respond, Resource Request, Intelligence Compare, or AMACS capability-management workflows.
