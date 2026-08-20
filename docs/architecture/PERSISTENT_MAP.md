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
6. Selected records render outside the clustered ordinary-marker source so selection remains legible.
7. The result drawer is authoritative; viewport scope filters located records but intentionally preserves off-map records.
8. Geographic authorization remains a service/API responsibility. Camera position is never authorization.
9. Progressive availability applies to workflows, not to the shell.
10. The provider adapter owns rendering/camera/tile mechanics; lenses own domain records and semantic overlays.
11. A basemap change changes only geographic presentation. Exchange records, clusters, overlays, selection, location, camera, drawer state, and marker hierarchy remain governed by the mounted Exchange shell.
12. The selected record owns the strongest 2.5D focus pin. Focus always outranks any persistent highlight marker.
13. Persistent 2.5D highlight pins are reserved for records that resolve through the governed `mapHighlight` policy, with backward-compatible support for existing featured/sponsored records, not for ordinary map records.
14. A record has one visible marker owner at a time: ordinary marker, 2.5D highlight pin, or 2.5D focus pin. The same record must not simultaneously render through multiple marker paths.
15. The teardrop tip is permanently anchored to the record's exact projected longitude/latitude. Highlight/focus presentation changes scale, opacity, and dimensional treatment; it never moves the geographic anchor away from the map.
16. Highlight reasons are domain/legal metadata. The map workspace does not add explanatory status text for why a marker is elevated.
17. Focus-marker motion respects `prefers-reduced-motion`; the information hierarchy remains available without animation.
18. The 2.5D pin is camera-facing and screen-readable, but its position is recomputed from MapLibre's own geographic projection on every render frame to remain stable during pan and zoom.

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
│   │   ├── Ordinary markers
│   │   ├── Persistent 2.5D highlight pins
│   │   └── Animated 2.5D focus pin
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

The live MapLibre instance switches styles in place. When a style reloads, the chassis reinstalls and repopulates its governed GeoJSON sources and the shared 2.5D custom marker layer so record markers, clusters, highlight/focus pins, viewer location, and supported lens heat/density overlays remain part of the same mounted Exchange experience.

2D/3D changes the live MapLibre pitch while preserving the current lens and results. Zoom changes the live camera. Reset clears the selected geography and viewport scope, returns to the canonical Exchange camera, and restores the Standard map type while retaining the user's layer visibility choices.

### Layers

The record layer uses a live clustered GeoJSON source. Located owned records, external records, and sponsored records receive distinct presentation. Intelligence and Capabilities can enable/disable their supported heat/density overlay. RFx and Resources do not receive invented analytical overlays.

The same shell-level record visibility also governs the 2.5D pin layer. Turning record markers off removes ordinary markers, focus pins, and highlight pins together.

Marker ownership is exclusive. When a record receives a 2.5D highlight or focus pin, the pin layer filters that record out of the normal point marker presentation. This prevents a default circle from remaining visible underneath the 2.5D pin.

### Geography

Geography choices are derived from actual current-lens records rather than hard-coded menu destinations. Selecting a geography updates both the map context and the shared geography filter. If a geography has no map coordinates, it still remains a valid result filter without manufacturing a point.

`Use my location` uses the browser Geolocation service, renders the current-location point, and recenters the shared map. No external reverse-geocoder is assumed.

### Search this area

The map reports its real visible bounds. `Search this area` copies those bounds into `queriedBounds`, and the result pipeline scopes located records to that viewport while retaining off-map records. Panning/zooming again marks the viewport dirty until the user deliberately reapplies the area. `/api/exchange/results` accepts `north`, `south`, `east`, and `west` query parameters and applies the same viewport service rule.

### Marker / cluster → result

MapLibre performs provider clustering. Selecting a cluster requests its real expansion zoom. Selecting an ordinary marker or visible 2.5D pin updates the shell's canonical `selectedRecordId`, which synchronizes the drawer card and detail surface.

### Animated 2.5D focus marker

A selected mapped record is removed from the ordinary clustered marker presentation and rendered through the shared `ExchangePinLayer` as the active focus pin.

The visible pin is not a polygon extrusion. It is a procedurally textured, camera-facing billboard with a classic teardrop location-pin silhouette, center opening, darker offset edge, inner-rim shading, and restrained specular highlights. The result is visually dimensional without behaving like a literal 3D solid that exposes an unreadable side/back face as the map rotates.

The teardrop tip is the geographic anchor. The renderer asks MapLibre to project the record's longitude/latitude to screen coordinates every render frame, then draws the body upward from that exact point. The pin never uses an elevated world coordinate or tether.

Focus transitions are driven by `requestAnimationFrame` over a short easing window. An ordinary record changes into the focus treatment through scale/opacity motion while preserving the same map point. A highlighted record transitions from highlight scale/emphasis to focus scale/emphasis. When focus moves away, it returns to highlight presentation when governed as a highlight, or yields marker ownership back to the ordinary marker path.

Rapid selection changes continue from current in-flight presentation state rather than resetting the animation. Users requesting reduced motion receive the same final hierarchy without animated interpolation.

### Persistent 2.5D highlight markers

Special map prominence is expressed through the `mapHighlight` projection on `ExchangeRecord`. The map renderer consumes the governed outcome rather than deciding business significance itself. Existing `featured` and sponsored resource/card states are supported as backward-compatible inputs so current real records can exercise the feature without inventing unsupported organization statuses.

The highlight resolver orders eligible mapped records by priority and applies a rendering budget of up to eight persistent 2.5D highlights. Highlight pins use the same pin family at a smaller scale, lower emphasis, and slightly darker RFx gold treatment. Focus is rendered separately with the brighter/larger treatment and always takes visual precedence.

Highlight reasons may include featured, sponsored, verified, recommended, time-sensitive, program, or custom classifications, but those reasons remain data/policy inputs. The map workspace does not render legal or semantic explanatory text beside the marker.

### 2.5D rendering architecture

The 2.5D pin renderer is implemented as one native MapLibre `CustomLayerInterface` with `renderingMode: "2d"`. It uses the map's WebGL context for drawing but does not use absolute Mercator coordinates as Float32 GPU vertex positions.

Instead, each render frame uses MapLibre's `map.project()` to compute the exact current screen coordinate from the record's longitude/latitude in JavaScript double precision. Only normalized screen coordinates near `[-1, 1]` are sent to the GPU. This avoids the precision loss that can make custom Mercator-space billboards visibly jitter during pan or zoom at higher map zoom levels.

Each rendered pin carries:

- record ID and real longitude/latitude;
- highlight or focus kind;
- visual scale;
- opacity.

The layer maintains screen-space hit regions derived from the same projected point used to draw the pin, so tapping the visible marker selects the same canonical Exchange record.

Because the 2.5D pins are part of the shared MapLibre style lifecycle, switching Standard, Detailed, Light, Dark, or Muted basemaps reinstalls the custom layer and reuses current focus/highlight state without changing Exchange selection.

## Lens projections

- **RFx** — located opportunity/RFx records and clusters.
- **Resources** — located providers/offers/requests and clusters; off-map and service-area records remain available in the drawer.
- **Intelligence** — located Intelligence records plus a real MapLibre heatmap treatment.
- **Capabilities** — located organizations/capabilities plus a real MapLibre density/heat treatment.

All four lenses inherit the same ordinary → highlight → focus marker hierarchy. The domains may supply highlight policy inputs, but they do not create their own marker renderer.

## Service boundaries

Implemented now:

- live MapLibre GL JS provider;
- selectable Standard, Detailed, Light, Dark, and Muted basemap types;
- in-place style switching with Exchange layer restoration;
- provider GeoJSON clustering;
- native MapLibre/WebGL 2.5D focus pin;
- governed persistent 2.5D highlight pins with capped priority selection;
- exclusive marker ownership so ordinary/selected circles do not remain under a 2.5D pin;
- exact pin-tip anchoring to MapLibre's projected geographic coordinate;
- screen-space projection that avoids Mercator Float32 jitter during pan/zoom;
- procedural teardrop pin texture with dimensional shading and center opening;
- animated ordinary → focus and highlight → focus transitions across scale and opacity;
- reduced-motion fallback;
- click selection on visible 2.5D pin geometry;
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
- production highlight policy/administration service for statuses beyond currently sourced featured/sponsored records;
- AMACS-derived production concentration datasets;
- production Intelligence aggregation datasets;
- durable map telemetry/observability backend;
- a production map style/tile service SLA.

These remain integration points, not placeholder buttons.
