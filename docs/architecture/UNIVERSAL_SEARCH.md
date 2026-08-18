# Universal Search

Universal Search is the shell-owned discovery capability inside the authenticated RFxchange Exchange. RFx, Resources, Intelligence, and Capabilities are lenses over the same search service. The active lens changes domain interpretation, facets, ranking, map treatment, and actions; it does not create another search application.

## Implemented hierarchy

The floating search surface now has explicit nested navigation state rather than one flat dropdown:

```text
Universal Search
├── Discover
│   ├── Suggestions
│   ├── Recent searches
│   │   └── Recent search
│   │       ├── Run
│   │       └── Save
│   └── Saved searches
│       └── Saved search
│           ├── Run
│           ├── Rename
│           ├── Edit criteria
│           ├── Alert on new / changed results
│           └── Delete
└── Refine results
    ├── Geography & map
    │   ├── Current Exchange geography
    │   ├── Place / ZIP / locality
    │   ├── Radius from map center
    │   ├── Current map area
    │   ├── Service geography       [Resources, Capabilities]
    │   └── Performance geography   [RFx]
    ├── Shared filters
    │   ├── Map presence
    │   ├── Organization relationship
    │   └── Shared metadata
    ├── Lens filters
    │   └── Source-supported facets for the active lens
    └── Sort
        ├── Best match
        ├── Most recent
        ├── Title
        └── Geography
```

No additional child branches should be added merely to make the tree look fuller. `lib/exchange/search-navigation.ts` is the governed source for this hierarchy and the source-supported lens facets.

### RFx facets

- issuer
- procurement / request type
- capability
- industry
- NAICS
- status

### Resources facets

- provider organization
- category / service
- eligibility
- need
- availability / modality

### Intelligence facets

- organization
- industry
- market
- capability
- signal
- dataset / trend

### Capabilities facets

- organization
- capability
- AMACS
- products / services
- industry
- evidence

## Search state

`ExchangeSearchState` is the canonical discovery state:

```text
query
filters
  geography
  geographyMode
  radiusMiles?
  center?
  bounds?
  location: all | mapped | off-map
  ownership: all | mine | others
  metadata[]
  facets{}
sort: relevance | recent | title | geography
```

It serializes into the Exchange URL so browser Back/Forward, deep links, and lens continuity can reconstruct the query. The map camera remains separate from query bounds until the user explicitly chooses **Search this area** or another map-driven geography workflow.

## Production service path

Production Universal Search no longer reads `exchangeSeed` from the API route.

```text
SearchControls
      |
      v
/api/exchange/results
      |
      v
trusted viewer / organization context
      |
      v
searchExchangeRepository
      |
      +--> PostgreSQL full-text search
      +--> PostGIS viewport / radius / area predicates
      +--> RFx / Resource / Intelligence / Capability joins
      +--> favorites / ownership projection when authenticated
      +--> sponsored-placement disclosure
      |
      v
normalized ExchangeSearchResponse
      |
      +--> PersistentMap
      └--> ResultsDrawer + cursor pagination
```

`DATABASE_URL` is required for production search. Optional `DATABASE_SSL=require` and `DATABASE_POOL_MAX` tune the pool.

### Query understanding

The production repository resolves search terms across normalized record identifiers, titles, organizations, summaries, public geography, metadata, AMACS node IDs, RFx solicitation types and requirements, Resource availability, and Intelligence signal/source context. Private bids, issuer notes, response evidence, and other protected workflow data are not part of the search projection.

### Geography behavior

- **Current Exchange geography**: uses the geography already governing the mounted Exchange.
- **Place / ZIP / locality**: filters the normalized public geography label.
- **Radius**: uses `ST_DWithin` against legitimate record coordinates.
- **Current map area**: writes the visible map bounds into `ExchangeSearchState` and uses `ST_Within` against a PostGIS envelope.
- **Service geography**: checks `locations.service_area` with `ST_Covers` for Resources and Capabilities.
- **Performance geography**: checks `rfx_records.performance_area` with `ST_Covers` for RFx.

Off-map records remain valid search results. They stay in the drawer and are never given fabricated coordinates just to appear on the map.

## Saved and recent discovery

Authenticated participants use server-persisted workflows:

```text
saved_searches
  user
  active organization (optional context)
  lens
  name
  normalized state
  alert_enabled
  result_fingerprint
  last_checked_at
  timestamps

search_activity
  SearchSubmitted
  user / organization
  lens
  normalized state
  result count
  timestamp
```

The participant API supports:

- `GET /api/exchange/searches?lens=...`
- `POST /api/exchange/searches`
- `PATCH /api/exchange/searches/{id}`
- `DELETE /api/exchange/searches/{id}`
- `POST /api/exchange/searches/recent`

### New / changed result detection

Alert configuration is not a presentation-only toggle. `lib/exchange/search-alerts.ts` evaluates each enabled saved search through the same production search repository, fingerprints the complete result-ID set, compares it with the prior run, updates `last_checked_at`, and emits a `SavedSearchChanged` activity event when the set changes.

A scheduler or operations service invokes:

```text
POST /api/exchange/searches/alerts/run
x-rfx-search-alert-secret: <RFXCHANGE_SEARCH_ALERT_SECRET>
```

This endpoint performs real change detection. Delivery of the resulting event as in-app/email/push notification remains owned by the shared RFxchange notification service and is not simulated by Universal Search.

## Authentication boundary

The repository currently does not contain a production participant session provider. Universal Search therefore does not trust unsigned cookies or browser-supplied IDs.

`resolveSearchPrincipal()` accepts verified identity only through a server-side identity bridge protected by `RFXCHANGE_IDENTITY_BRIDGE_SECRET`, then confirms the active organization against `organization_memberships`. Anonymous users can use public discovery. User-scoped Recent/Saved workflows return an authentication requirement until the platform's production identity provider supplies trusted context.

This is deliberate: a missing identity provider is a visible integration dependency, not a mock user hidden inside the search service.

## Static GitHub Pages preview

GitHub Pages cannot execute the RFxchange APIs or PostgreSQL service. The Pages workflow therefore sets `NEXT_PUBLIC_RFXCHANGE_PREVIEW=1` after preparing its static projection. Only in that explicit preview build does the Exchange use the in-memory reference records and browser-local search library.

The production build never silently falls back to reference data. If its database is unavailable, the results API returns a service-unavailable response and the drawer exposes its existing error/retry state.

## Database migration

For an existing RFxchange database, apply:

```text
db/migrations/20260818_universal_search.sql
```

It adds:

- public geography labels and identifiers to the full-text search document;
- RFx performance-area geometry;
- saved searches, alert fingerprints, and last-check state;
- search activity / recent history;
- disclosed sponsored placements;
- supporting full-text, geospatial, and lookup indexes.

## Remaining external integrations

Universal Search does not fabricate integrations that are not present in this repository. These remain explicit external dependencies:

- the production identity provider that establishes participant sessions;
- external AMACS taxonomy/synonym retrieval beyond AMACS IDs and metadata already stored in RFxchange;
- an external geocoder/place service for resolving arbitrary typed addresses into canonical geometry;
- shared notification delivery for `SavedSearchChanged` events.

Those systems connect behind the search and shared-service boundaries; their absence does not justify mocked production responses.
