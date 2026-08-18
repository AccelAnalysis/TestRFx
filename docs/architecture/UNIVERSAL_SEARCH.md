# Universal Search

Universal Search is a shell-owned capability inside the authenticated RFxchange Exchange. It is one persistent search surface shared by the RFx, Resources, Intelligence, and Capabilities lenses. The active lens changes interpretation, suggestions, filters, ranking, and results; it does not create a separate search application.

## Governing rules

1. **One search surface.** RFx, Resources, Intelligence, and Capabilities reuse the same component and search contract.
2. **Lens-aware interpretation.** Each lens supplies its placeholder and domain projection while the chassis owns interaction and state.
3. **Search is not geography.** Query text answers “what”; structured filters constrain results; the map remains the spatial exploration surface.
4. **Drawer is authoritative.** Located records appear in both map and drawer. Off-map records remain valid drawer results and must never receive fabricated coordinates.
5. **State survives navigation.** Query, filters, sort, selection, drawer state, and detail navigation remain part of the mounted Exchange experience.
6. **Authorization precedes presentation.** A production search service must remove records and fields the viewer is not authorized to discover before returning results to the shell.
7. **Commercial status does not buy organic ranking.** Sponsored placements must be explicitly labeled and kept separate from relevance/match scoring.

## Search state

The chassis models search as `ExchangeSearchState`:

```text
query
filters
  geography
  location: all | mapped | off-map
  ownership: all | mine | others
  metadata[]
sort: relevance | title | geography
```

The state serializes to URL query parameters so deep links and browser Back/Forward can restore discovery context.

## Current reference adapter

`lib/exchange/search.ts` is a deterministic adapter over `exchangeSeed`. It provides:

- lens filtering;
- weighted text relevance across title, organization, summary, geography, and metadata;
- geography, map-presence, ownership, and metadata filters;
- relevance/title/geography sorting;
- suggestion generation;
- mapped/off-map result counts;
- URL parse/serialize helpers.

The reference adapter is intentionally replaceable. Production retrieval can move behind PostgreSQL full-text search, PostGIS, OpenSearch/Elasticsearch, AMACS taxonomy resolution, or another search service without changing the shell-level `ExchangeSearchState` and normalized `ExchangeRecord` contracts.

## Search flow

```text
Universal Search UI
        |
        v
Search context
  lens + query + filters + sort
        |
        v
Search adapter / API
        |
        +--> normalized results --> Sliding result drawer
        |
        +--> located results -----> Persistent map
```

The current API route at `/api/exchange/results` accepts the same search-state parameters and returns normalized records, match metadata, result counts, and the lens action projection.

## Lens continuity

Each lens keeps its own filter/sort state. When a user moves to a lens that does not yet have a query, the current query carries across so a concept such as “cybersecurity” can be reinterpreted by the next lens. Returning to a lens restores the discovery state previously used there.

This preserves the RFxchange mental model: the user remains in one Exchange and changes what they are looking at.

## Recent and saved searches

The reference chassis keeps recent and saved searches in browser local storage. They are lens-scoped and restore the full normalized search state. This is a UI/reference integration point only; production persistence should associate saved searches with the authenticated user/organization and may drive notification or digest workflows.

## Production integration points

A production Universal Search service should add, behind the existing contract:

- authenticated viewer and active-organization context;
- server-side authorization and field projection;
- AMACS capability and synonym resolution;
- geographic place/radius/service-area/viewport queries;
- cursor pagination and stable result ordering;
- saved-search persistence and alerts;
- sponsored-result disclosure separate from organic ranking;
- activity events such as `SearchSubmitted`, `SearchResultSelected`, and `SearchNoResults`;
- privacy-safe analytics for aggregate demand intelligence.

The shell should not absorb those domain concerns. Its job is to keep search interaction, state, map/drawer projection, accessibility, and lens continuity stable while search infrastructure evolves.
