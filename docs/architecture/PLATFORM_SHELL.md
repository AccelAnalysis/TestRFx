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
- `MapViewState` owns the persistent camera, geography, layer visibility, current provider bounds, and deliberately applied viewport-query bounds.
- Menu is intentionally outside `ExchangeLens`.

## State continuity

Opening record detail overlays the still-mounted Exchange shell. Closing it returns to the same lens, search query, selected marker/card, drawer state, and list scroll position. Menu behaves the same way.

The Persistent Map is now backed by a live MapLibre GL JS adapter while retaining provider-neutral shell state. Map rendering, clustering, heat treatment, and real camera bounds remain inside the map subsystem rather than lens pages. See [`PERSISTENT_MAP.md`](PERSISTENT_MAP.md).

## Responsive composition

Mobile uses a full-screen map, floating translucent search/controls, three-state bottom drawer, and safe-area-aware bottom navigation. Desktop keeps the same information architecture while converting the drawer into a persistent right-side results surface and the bottom navigation into a floating dock.

## Persistence boundary

`db/schema.sql` defines the production-target PostgreSQL/PostGIS shape. The UI still runs from deterministic/reference records so the chassis can be exercised without requiring infrastructure credentials. `/api/exchange/results` demonstrates the application boundary and now accepts optional viewport bounds while still returning normalized records/actions rather than exposing tables to UI components.

The map provider and browser Geolocation service are live. Authoritative organization/RFx/resource/intelligence/capability persistence, geographic authorization, PostGIS viewport queries, production geocoding, and production map style/tile SLAs remain external infrastructure boundaries rather than being simulated in the client.

## Progressive availability

Incomplete business workflows remain visible in their governed action positions but disabled with an explicit reason. This lets the complete shell be acceptance-tested before every downstream workflow is implemented.

## Next integration steps

Product work should plug into the existing contracts rather than alter shell composition:

- RFx: response, teaming, watch, issuer, and RFx lifecycle repositories.
- Resources: durable offer/request, availability, connection, and fulfillment repositories/services.
- Intelligence: authoritative datasets, comparison/tracking provenance, and production geographic aggregations.
- Capabilities: AMACS projection, capability evidence, organization discovery, matching, and publishing.
- Referrals: cross-lens workflow launched from governed actions and managed from Menu.
- Identity: real session/auth provider and server-side authorization.
- Persistence: repository adapters backed by PostgreSQL/PostGIS and object storage.
- Maps: production-approved style/tile service, authorized boundary data, geocoder, and server-side spatial querying.
