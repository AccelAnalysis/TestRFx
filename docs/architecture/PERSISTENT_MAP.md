# Authenticated Exchange Shell — Persistent Map

## Purpose

The Persistent Map is the spatial operating context of the authenticated RFxchange Exchange. It is a shell primitive, not a page and not a lens-owned implementation. RFx, Resources, Intelligence, and Capabilities project normalized Exchange records and map semantics into the same mounted map environment. Menu overlays the current Exchange state and does not change the map lens.

The current implementation uses **MapLibre GL JS** as the live provider adapter. The style URL is configurable through `NEXT_PUBLIC_RFX_MAP_STYLE_URL`; the repository falls back to MapLibre's public demo style for development/preview.

## Governing invariants

1. One primary map instance belongs to the authenticated Exchange shell.
2. RFx, Resources, Intelligence, and Capabilities change map presentation; they do not create new map applications.
3. Camera state survives lens changes, detail overlays, and Menu overlays.
4. Marker, card, and detail surfaces share one `selectedRecordId`.
5. Records without coordinates remain valid drawer results and do not receive artificial map points.
6. Selected records render outside the clustered source so selection remains legible.
7. The result drawer is authoritative; viewport scope filters located records but intentionally preserves off-map records.
8. Geographic authorization remains a service/API responsibility. Camera position is never authorization.
9. Progressive availability applies to workflows, not to the shell.
10. The provider adapter owns rendering/camera/tile mechanics; lenses own domain records and semantic overlays.

## True map hierarchy

Only source-supported controls are represented. Search, Filter, and Sort remain sibling chassis workflows because they shape the result set across map and drawer; they are not duplicated inside the map menu.

```text
Authenticated Exchange → Persistent Map
│
├── View
│   ├── 2D map
│   ├── 3D map
│   ├── Zoom in
│   ├── Zoom out
│   └── Reset Exchange view
│
├── Layers
│   ├── Record markers & clusters
│   └── Lens overlay (only when the lens supports one)
│       ├── Intelligence → Heat / concentration
│       └── Capabilities → Capability density
│
└── Geography
    ├── Exchange geography / clear selected geography
    ├── Source-backed geography choices from current lens records
    ├── Use my location
    └── Search this area
```

The UI keeps nested navigation state (`root → view | layers | geography`) with a Back path rather than exposing unrelated controls as one flat popover.

## Concrete workflows

### View

2D/3D changes the live MapLibre pitch while preserving the current lens and results. Zoom changes the live camera. Reset clears the selected geography and viewport scope and returns to the canonical Exchange camera.

### Layers

The record layer uses a live clustered GeoJSON source. Located owned records, external records, and sponsored records receive distinct presentation. Intelligence and Capabilities can enable/disable their supported heat/density overlay. RFx and Resources do not receive invented analytical overlays.

### Geography

Geography choices are derived from actual current-lens records rather than hard-coded menu destinations. Selecting a geography updates both the map context and the shared geography filter. If a geography has no map coordinates, it still remains a valid result filter without manufacturing a point.

`Use my location` uses the browser Geolocation service, renders the current-location point, and recenters the shared map. No external reverse-geocoder is assumed.

### Search this area

The map reports its real visible bounds. `Search this area` copies those bounds into `queriedBounds`, and the result pipeline scopes located records to that viewport while retaining off-map records. Panning/zooming again marks the viewport dirty until the user deliberately reapplies the area. `/api/exchange/results` accepts `north`, `south`, `east`, and `west` query parameters and applies the same viewport service rule.

### Marker / cluster → result

MapLibre performs provider clustering. Selecting a cluster requests its real expansion zoom. Selecting a record point updates the shell's canonical `selectedRecordId`, which synchronizes the drawer card and detail surface.

## Lens projections

- **RFx** — located opportunity/RFx records and clusters.
- **Resources** — located providers/offers/requests and clusters; off-map and service-area records remain available in the drawer.
- **Intelligence** — located Intelligence records plus a real MapLibre heatmap treatment.
- **Capabilities** — located organizations/capabilities plus a real MapLibre density/heat treatment.

## Service boundaries

Implemented now:

- live MapLibre GL JS provider;
- provider GeoJSON clustering;
- provider heatmap layer;
- browser Geolocation;
- real map bounds/camera synchronization;
- source-backed geography hierarchy;
- concrete viewport-query service shared by UI and results API;
- mapped/off-map/sponsored map classification;
- map failure degradation that leaves the drawer usable.

Still requires external production infrastructure or authoritative data and therefore is **not** fabricated in this repository:

- server-authorized geography/boundary datasets;
- PostGIS-backed viewport, polygon, service-area, and intersection queries;
- production geocoder/reverse-geocoder;
- AMACS-derived production concentration datasets;
- production Intelligence aggregation datasets;
- durable map telemetry/observability backend;
- a production map style/tile service SLA.

These remain integration points, not placeholder buttons.
