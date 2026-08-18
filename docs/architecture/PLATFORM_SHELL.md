# RFxchange Operating Chassis

## Architectural rule

RFx, Resources, Intelligence, and Capabilities are lenses over one persistent Exchange environment. They are not separate applications. Menu is a cross-lens utility surface, not a lens.

## Three shells

1. **Public / Acquisition** — marketing, campaign pages, public resources, pricing, legal, login/register entry.
2. **Identity & Onboarding** — login, registration, verification, organization selection/creation, geography, profile, capability enrichment, Exchange-ready completion.
3. **Authenticated Exchange** — persistent map, universal search, floating controls, result drawer, four-slot lens action rail, shared record cards, detail controller, bottom lens navigation, and menu utility surface.

## Dependency direction

```text
Platform Shell
  ^
  | implements governed contracts
  +-- RFx
  +-- Resources
  +-- Intelligence
  +-- Capabilities
```

The shell never imports lens-specific workflow implementation. A lens supplies definitions, normalized records, map layers, and actions through the contracts in `lib/exchange/contracts.ts`.

## Core contracts

- `ExchangeLens` limits the persistent bottom navigation to RFx, Resources, Intelligence, and Capabilities.
- `ExchangeRecord` is the normalized projection consumed by map, card, selection, and detail primitives.
- `LensAction` owns one of four governed action positions and explicitly exposes visibility, applicability, authorization, operational readiness, and an unavailable reason.
- `DrawerState` is `peek | mid | expanded`.
- `MapViewState` gives the shell one provider-neutral camera/geography contract for the mounted Persistent Map.
- Menu is intentionally outside `ExchangeLens`.

## State continuity

Opening record detail overlays the still-mounted Exchange shell. Closing it returns to the same lens, search query, selected marker/card, drawer state, list scroll position, and map camera. Menu behaves the same way. Lens changes retain the shared map camera/geography context while replacing the active lens projection.

The Persistent Map contract and provider boundary are documented in [`PERSISTENT_MAP.md`](PERSISTENT_MAP.md). The reference spatial canvas can be replaced by a Mapbox GL JS or MapLibre adapter without changing lens contracts.

## Responsive composition

Mobile uses a full-screen map, floating translucent search/controls, three-state bottom drawer, and safe-area-aware bottom navigation. Desktop keeps the same information architecture while converting the drawer into a persistent right-side results surface and the bottom navigation into a floating dock.

## Persistence boundary

`db/schema.sql` defines the production-target PostgreSQL/PostGIS shape. The UI currently runs from deterministic seed records so the chassis can be exercised without requiring infrastructure credentials. `/api/exchange/results` demonstrates the application boundary and returns normalized records/actions instead of exposing tables to UI components.

## Progressive availability

Incomplete business workflows remain visible in their governed action positions but disabled with an explicit reason. This lets the complete shell be acceptance-tested before every downstream workflow is implemented.

## Next integration steps

Product work should plug into the existing contracts rather than alter shell composition:

- Persistent Map: provider adapter, authorized geography, viewport querying, PostGIS spatial queries, production clusters, heat/polygon layers, geocoder/current location, and location privacy.
- RFx: response, teaming, watch, issuer, and RFx lifecycle repositories.
- Resources: offer/request, availability, connection, and fulfillment workflows.
- Intelligence: real datasets, heat/polygon layers, comparison, tracking, and source provenance.
- Capabilities: AMACS projection, capability evidence, organization discovery, matching, and publishing.
- Referrals: cross-lens workflow launched from governed actions and managed from Menu.
- Identity: real session/auth provider and server-side authorization.
- Persistence: repository adapters backed by PostgreSQL/PostGIS and object storage.
