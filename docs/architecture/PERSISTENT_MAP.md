# Authenticated Exchange Shell — Persistent Map

## Purpose

The Persistent Map is the spatial operating context of the authenticated RFxchange Exchange. It is a shell primitive, not a page and not a lens-owned implementation. RFx, Resources, Intelligence, and Capabilities project normalized Exchange records and map presentation into the same mounted map environment. Menu overlays the current Exchange state and does not change the map lens.

This module implements the provider-neutral chassis contract. A production Mapbox GL JS or MapLibre adapter can replace the reference spatial canvas without changing lens, record, drawer, card, selection, or detail contracts.

## Governing invariants

1. One primary map instance belongs to the authenticated Exchange shell.
2. RFx, Resources, Intelligence, and Capabilities change map presentation; they do not create new map applications.
3. Camera state survives lens changes, detail overlays, and Menu overlays.
4. Marker, card, and detail surfaces share one `selectedRecordId`.
5. Records without coordinates remain valid drawer results and do not receive artificial map points.
6. Selected records are broken out of clusters so selection remains legible.
7. The map is supplemental to the accessible result list; every mapped record remains reachable through the drawer.
8. Geographic authorization is a service/API responsibility. Camera position must never be treated as authorization.
9. Progressive availability applies to workflows, not to the shell: unavailable downstream actions do not close the map.
10. The provider adapter owns camera/tile/rendering details; lenses own domain data and map semantics.

## Chassis state

`MapViewState` adds a governed shell contract for:

- camera center;
- zoom;
- bearing;
- pitch;
- 2D/3D mode;
- current Exchange geography context;
- optional queried bounds for a future viewport-query/search-this-area service.

The current shell owns this state in `ExchangeShell`, which keeps it mounted while detail and Menu surfaces appear above it.

## Lens projections

The provider-neutral reference implementation exposes four map presentations:

- **RFx** — point/cluster opportunity view.
- **Resources** — point/cluster availability view.
- **Intelligence** — analytical heat treatment over located intelligence records.
- **Capabilities** — density treatment over located organization capability records.

These treatments are deliberately presentation-level. Production heatmaps, polygons, service areas, AMACS concentration layers, and sponsored layers should be supplied through a future map-provider/layer adapter rather than embedded directly in lens pages.

## Interaction contract

### Marker → record

Selecting a marker calls the shell's shared record selector. If the result drawer is in Peek, the shell promotes it to Mid so the synchronized card becomes visible.

### Record → marker

Selecting a card updates the same `selectedRecordId`, which highlights the corresponding marker when a location exists. Off-map records remain selected in the drawer without map side effects.

### Cluster → camera

Selecting a cluster recenters the reference camera on the cluster and increases zoom. Once the map crosses the clustering threshold, individual records are exposed.

### Pan / zoom / 2D–3D

The reference canvas supports pointer pan, keyboard pan, keyboard zoom, explicit zoom controls, and 2D/3D presentation switching. The top-shell Reset Map control restores the default Exchange geography view.

## Provider boundary

`lib/exchange/map-model.ts` is intentionally provider-neutral. It currently supplies:

- default map/geography state;
- lens map presentation metadata;
- coordinate projection for the deterministic reference canvas;
- record mapped/off-map summary;
- clustering;
- pan and zoom camera operations;
- map bounds derivation;
- 2D/3D state changes.

A production adapter should implement equivalent behavior against the chosen map provider while preserving `MapViewState` and shell selection semantics.

## Production integration points

The next map-specific integrations belong behind this boundary:

- Mapbox GL JS / MapLibre provider adapter;
- server-authorized geography and locality boundaries;
- viewport and `Search this area` querying;
- PostGIS point, polygon, service-area, and intersection queries;
- production marker clustering;
- Intelligence heat/fill/polygon layers;
- AMACS capability density layers;
- current-location/geocoder services;
- location privacy modes (exact, approximate, service area, hidden);
- sponsored marker governance;
- map performance/error telemetry.

None of those integrations should require RFx, Resources, Intelligence, or Capabilities to replace the shared shell composition.
