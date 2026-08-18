# TestRFx — RFxchange operating chassis

Reference implementation of the shared RFxchange platform shell. The purpose of this repository is to prove the operating chassis before downstream product areas add full business workflows.

## What is implemented

- Public/acquisition Marketing shell with campaign bar, narrative journey, shared public chrome, audience pages, Founding Membership, footer, and public bottom-matter destinations
- Acquisition-context capture and query carryover into `/join` and `/signin`, which hand off to the existing Registration/Login shell
- Identity shell with Login and Registration
- Guided Onboarding shell boundary
- Persistent authenticated Exchange composition
- Live MapLibre GL JS Persistent Map with provider clustering, real camera/bounds state, 2D/3D, current location, and graceful map-failure fallback
- Hierarchical Map controls: View → 2D/3D/zoom/reset; Layers → records plus supported lens overlay; Geography → source-backed geography/current location/search-this-area
- Concrete viewport querying that scopes mapped records while preserving off-map results
- Intelligence heat and Capabilities density layers rendered by the live map provider
- Mapped / off-map / owned / external / sponsored map classification
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
- Normalized Exchange API boundary, including optional viewport bounds
- PostgreSQL/PostGIS reference schema
- Responsive desktop composition and mobile safe-area support
- Reduced-motion and keyboard-accessible control paths

## Architecture

RFxchange is organized as three shells: Public / Acquisition, Identity & Onboarding, and the Authenticated Exchange. RFx, Resources, Intelligence, and Capabilities are **lenses over one Exchange**, not separate applications. Menu is a utility surface.

- [`docs/architecture/PLATFORM_SHELL.md`](docs/architecture/PLATFORM_SHELL.md) — authenticated operating chassis
- [`docs/architecture/PERSISTENT_MAP.md`](docs/architecture/PERSISTENT_MAP.md) — live Persistent Map, hierarchy, viewport service, and remaining production boundaries
- [`docs/architecture/MARKETING_SHELL.md`](docs/architecture/MARKETING_SHELL.md) — Public / Acquisition → Marketing structure and handoff contract

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` for Marketing or jump directly to `http://localhost:3000/exchange/rfx` for the Exchange.

The map uses MapLibre's public demo style by default. Set `NEXT_PUBLIC_RFX_MAP_STYLE_URL` to the production-approved style service when one is available.

## Validation

```bash
npm run typecheck
npm run build
```

GitHub Actions runs both commands on pull requests and pushes to `main` and `agent/**` branches.

## Intentional boundaries

This chassis does **not** claim production completion for authentication, durable acquisition analytics, legal policy content, RFx response/team workflows, AMACS production datasets/evidence, durable resource transactions, production intelligence datasets, referrals/payments, notifications, server-authorized geographies, PostGIS-backed viewport queries, production geocoding, or a production map tile/style SLA. Those capabilities plug into the contracts and live service boundaries established here.
