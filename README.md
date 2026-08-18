# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The purpose of this repository is to prove the operating chassis before downstream product areas add full business workflows.

## What is implemented

- Public/acquisition Marketing shell with campaign bar, narrative journey, shared public chrome, audience pages, Founding Membership, footer, and public bottom-matter destinations
- Acquisition-context capture and query carryover into `/join` and `/signin`, which hand off to the existing Registration/Login shell
- Identity shell with Login and Registration
- Guided Onboarding shell boundary
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

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing or jump directly to `http://localhost:3000/exchange/rfx` for the reference Exchange.

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches.

## Intentional boundaries

This chassis does **not** claim production completion for authentication, durable acquisition analytics, legal policy content, RFx response/team workflows, AMACS evidence, resource transactions, intelligence datasets, referrals/payments, notifications, or real map tiles. Those capabilities plug into the contracts already established here.
