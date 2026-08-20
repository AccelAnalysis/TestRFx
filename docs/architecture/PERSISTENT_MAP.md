# Authenticated Exchange Shell — Persistent Map

## Purpose

The Persistent Map is the spatial operating context of the authenticated RFxchange Exchange. It is a shell primitive, not a page and not a lens-owned implementation. RFx, Resources, Intelligence, and Capabilities project normalized Exchange records and map semantics into the same mounted map environment. Menu overlays the current Exchange state and does not change the map lens.

The current implementation uses **MapLibre GL JS** as the live provider adapter. The Map options expose a governed set of real OpenFreeMap basemap styles. `NEXT_PUBLIC_RFX_MAP_STYLE_URL` can override the Standard map type while the remaining map types use the shared style catalog in `lib/exchange/map-styles.ts`.

## Governing invariants

1. One primary map instance belongs to the authenticated Exchange shell.
2. RFx, Resources, Intelligence, and Capabilities change map presentation; they do not create new map applications.
3. Camera state survives lens changes, detail overlays, Menu overlays, and basemap changes.
4. Marker, card, and detail surfaces share one `selectedRecordId`.
5. Records without coordinates remain valid drawer results and do not receive artificial map points.
6. Selected records render outside the clustered source so selection remains legible.
7. The result drawer is authoritative; viewport scope filters located records but intentionally preserves off-map records.
8. Geographic authorization remains a service/API responsibility. Camera position is never authorization.
9. Progressive availability applies to workflows, not to the shell.
10. The provider adapter owns rendering/camera/tile mechanics; lenses own domain records and semantic overlays.
11. A basemap change changes only geographic presentation. Exchange records, clusters, overlays, selection, location, camera, and drawer state remain governed by the mounted Exchange shell.

## True map hierarchy

Search, Filter, and Sort remain sibling chassis workflows because they shape the result set across map and drawer; they are not duplicated inside the map menu. Basemap selection belongs under View because it changes how the map is rendered rather than which Exchange records are present.

```text
Authenticated Exchange → Persistent Map
│
├── View
│   ├── Map type
│   │   ├── Standard — OpenFreeMap Liberty
│   │   ├── Detailed — OpenFreeMap Bright
│   │   ├── Light — OpenFreeMap Positron
│   │   ├── Dark — OpenFreeMap Dark
│   │   └── Muted — OpenFreeMap Fiord
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

The UI keeps nested navigation state (`root → view → map type`, or `root → layers | geography`) with a Back path rather than exposing unrelated controls as one flat popover.

## Concrete workflows

### View and Map type

`Map type` selects the geographic basemap while preserving the current Exchange context. The five choices are intentionally presentation variants rather than new lenses:

- **Standard** — balanced street, building, place, and point-of-interest detail.
- **Detailed** — higher-contrast roads, boundaries, labels, and place detail.
- **Light** — a restrained background for dense Exchange records and overlays.
- **Dark** — a low-light basemap that preserves bright Exchange overlays.
- **Muted** — a subdued geographic background for lower visual competition with Exchange data.

The live MapLibre instance switches styles in place. When a style reloads, the chassis reinstalls and repopulates its governed GeoJSON sources and layers so record markers, clusters, selected records, viewer location, and supported lens heat/density overlays remain part of the same mounted Exchange experience.

2D/3D changes the live MapLibre pitch while preserving the current lens and results. Zoom changes the live camera. Reset clears the selected geography and viewport scope, returns to the canonical Exchange camera, and restores the Standard map type while retaining the user's layer visibility choices.

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
- selectable Standard, Detailed, Light, Dark, and Muted basemap types;
- in-place style switching with Exchange layer restoration;
- provider GeoJSON clustering;
- provider heatmap layer;
- browser Geolocation;
- real map bounds/camera synchronization;
- source-backed geography hierarchy;
- concrete viewport-query service shared by UI and results API;
- mapped/off-map/sponsored map classification;
- map failure degradation that leaves the drawer usable.

Still requires external production infrastructure or authoritative data and therefore is **not** fabricated in this repository:

- satellite/aerial imagery with an approved production provider and licensing/access configuration;
- server-authorized geography/boundary datasets;
- PostGIS-backed viewport, polygon, service-area, and intersection queries;
- production geocoder/reverse-geocoder;
- AMACS-derived production concentration datasets;
- production Intelligence aggregation datasets;
- durable map telemetry/observability backend;
- a production map style/tile service SLA.

These remain integration points, not placeholder buttons.
