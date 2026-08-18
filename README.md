# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The purpose of this repository is to prove the operating chassis before downstream product areas add full business workflows.

## What is implemented

- Public/acquisition Marketing shell with campaign bar, narrative journey, shared public chrome, audience pages, Founding Membership, footer, and public bottom-matter destinations
- Acquisition-context capture and query carryover into `/join` and `/signin`, which hand off to the existing Registration/Login shell
- Identity shell with Login and Registration
- Guided Onboarding shell boundary
- Source-exact Capability Enrichment hierarchy with addressable child/grandchild workflow routes
- PostgreSQL-backed capability claims, solutions, evidence, discoverability terms, and onboarding progress
- Immutable AMACS release projection/import path plus canonical AMACS search and provider-neutral interpretation integration
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
- Seeded Exchange records including owned, external, located, and off-map examples
- Normalized Exchange API boundary
- PostgreSQL/PostGIS reference schema
- Responsive desktop composition and mobile safe-area support
- Reduced-motion and keyboard-accessible control paths

## Architecture

RFxchange is organized as three shells: Public / Acquisition, Identity & Onboarding, and the Authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are **lenses over one Exchange**, not separate applications. Menu is a utility surface.

- [`docs/architecture/PLATFORM_SHELL.md`](docs/architecture/PLATFORM_SHELL.md) — authenticated operating chassis
- [`docs/architecture/MARKETING_SHELL.md`](docs/architecture/MARKETING_SHELL.md) — Public / Acquisition → Marketing structure and handoff contract
- [`docs/architecture/CAPABILITY_ENRICHMENT.md`](docs/architecture/CAPABILITY_ENRICHMENT.md) — Identity & Onboarding → Capability Enrichment hierarchy, persistence, AMACS, and service boundaries

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing or jump directly to `http://localhost:3000/exchange/rfx` for the Exchange shell.

Capability Enrichment's canonical service requires the database migrations and `DATABASE_URL`. Import a governed AMACS release with:

```bash
npm run amacs:import -- /absolute/path/to/amacs-release/<version>
```

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches.

## Intentional boundaries

This chassis does **not** claim production completion for authentication, durable acquisition analytics, legal policy content, RFx response/team workflows, external capability verification, resource transactions, intelligence datasets, referrals/payments, notifications, or real map tiles. Capability Enrichment no longer uses mock persistence or mock AMACS/evidence actions: when its required database, identity, or interpretation service is not connected, it reports that service boundary instead of fabricating success.
