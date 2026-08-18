# Authenticated Exchange — Floating Controls

## Purpose

Floating Controls are shared operating-chassis infrastructure layered over the persistent Exchange map. They manipulate the current Exchange view; they do not navigate away from the Exchange and they do not own lens business workflows.

Universal Search remains a sibling chassis primitive. The search surface and Floating Controls occupy one visual command zone, but their contracts remain separate. The same filter workflow is also reachable from the result-drawer **Filter** control required by the source architecture; that second entry point does not create a second filter implementation.

## Source-governed hierarchy

Only children supported by the supplied platform structure and the established Floating Controls design are represented. No Intelligence-only overlay taxonomy or other speculative menu branches are invented.

```text
Floating Controls
│
├── Filter
│   ├── Geography
│   │   ├── All geographies
│   │   └── Available geography values for the active lens
│   │
│   ├── Organization relationship
│   │   ├── All organizations
│   │   ├── My organization
│   │   └── Other organizations
│   │
│   ├── Map availability
│   │   ├── Mapped + off-map
│   │   ├── Mapped only
│   │   └── Off-map only
│   │
│   ├── Placement                          [when supported by actual records]
│   │   ├── All placements
│   │   └── Featured only
│   │
│   ├── Lens facets                        [when actual facet values exist]
│   │   └── Active-lens metadata values
│   │
│   ├── Clear all filters
│   ├── Cancel
│   └── Apply → Show N results
│
├── Location / Recenter
│   ├── Request browser location permission
│   ├── Acquire current coordinates
│   ├── Recenter camera on current location
│   └── Report denied/unavailable state without blocking browsing
│
├── Map controls
│   ├── Map display
│   │   ├── 2D
│   │   ├── 3D
│   │   └── Reset north                     [when bearing is non-zero]
│   │
│   ├── Fit current results
│   ├── Center selected geography           [when a geography filter is active]
│   ├── Search this area                    [after viewport changes]
│   ├── Clear searched area                 [when a viewport query is active]
│   └── Reset map view
│
├── Active filter chips
│   └── Remove individual filter directly
│
└── Result drawer → Filter
    └── Opens the same Filter hierarchy above
```

The component keeps a stack of `FloatingControlRoute` values. Parent → child navigation therefore has explicit nested state rather than hiding all controls inside one flat panel. Escape closes the current control surface and child pages expose a Back action.

## Mobile composition

The default map-first command zone stays deliberately small:

```text
[ Universal Search                         ] [Filter] [Locate]
                                                      [Map]
                                                      [Reset]

        [ active filter chips, only when needed ]

                    Persistent map

                 [ Search this area ]
                    (contextual only)
```

Sort remains a drawer utility. Filter appears both as the source-required drawer header action and as the thumb-reachable floating control, but both open the same workflow and state.

## Filter lifecycle

`ExchangeFilters` contains only normalized control concepts supported by the current chassis:

- geography;
- organization relationship (`all | mine | others`);
- map availability (`all | mapped | off-map`);
- featured placement where supported;
- active-lens metadata facets.

Metadata values are ORed within the metadata group. The major groups are ANDed together.

The hierarchy uses draft state until **Show N results** is selected. Cancel discards the draft. Clear All resets the draft. Applied filters produce removable chips above the map.

Filter state is stored independently for RFx, Resources, Intelligence, and Capabilities and persisted in browser `localStorage`. A normalization/migration function reads previously stored `mappedOnly` state without breaking existing sessions. Switching lenses therefore does not force incompatible RFx filters into Capabilities, and returning to a lens restores that lens's prior applied filters.

Production domain services may replace facet vocabularies behind this lifecycle, but a lens must not create a second filter toolbar or separate filter state engine.

## Geography and location are distinct

The shell deliberately keeps these concepts separate:

```text
Browser/device location
Selected geography filter
Search geography
Organization location
Record coordinate
Service area
Map camera
Queried viewport bounds
```

The browser Location control uses `navigator.geolocation`. On success it now does more than draw a marker: it recenters the current camera on the acquired coordinate, raises zoom to a useful local level, clears a stale map-area query, and records the `located` state. Permission denial or device failure leaves search, filtering, cards, and the drawer usable.

**Center selected geography** is different. It uses legitimately located records in the selected geography to compute a fitted camera. If that geography has no mapped records, the command reports that condition rather than inventing coordinates.

## Map display and camera workflows

The shell's `MapViewState` is the source of truth for display mode and camera state.

### 2D / 3D

2D sets pitch to zero. 3D uses the existing chassis pitch treatment. This is presentation state and does not change the result query.

### Reset north

A compass/reset-north action is exposed only if bearing is materially non-zero. It sets the camera bearing back to `0` without changing filters or selected results.

### Fit current results

`fitMapCameraToRecords()` calculates a camera from the legitimate coordinates of the current result set. It does not fabricate coordinates for off-map records. With one mapped record, the camera centers on that record; with multiple mapped records it calculates the geographic extent, applies padding, and clamps the result to the chassis zoom limits.

### Reset map view

Reset restores the canonical Exchange map view and removes any active viewport query.

## Search this area is now a real workflow

The prior implementation exposed a `Search this area` button whose handler only cleared a dirty flag. That was an inert placeholder and has been removed.

The concrete workflow is now:

```text
User pans / zooms map
        ↓
MapViewState camera changes
        ↓
viewportDirty = true
        ↓
Search this area
        ↓
mapBoundsForCamera(current camera)
        ↓
MapViewState.queriedBounds is set
        ↓
filterRecordsToMapBounds(...)
        ↓
Drawer + markers use records inside those bounds
```

A viewport query is explicitly spatial. While it is active, records without legitimate coordinates are not included in that bounded spatial result set because the platform must not invent a location for them. **Clear searched area** removes the bounds and immediately restores eligible off-map records to the authoritative drawer.

Changing the map again marks the viewport dirty and offers Search This Area again. The currently committed bounds remain the query until the user explicitly commits the newer viewport or clears the area query.

## Map provider boundary

This PR replaces inert Floating Controls behavior with concrete chassis state and browser-service behavior, but it does **not** misrepresent the repository's reference spatial renderer as a production basemap service.

The current `PersistentMap` already provides real camera state, pointer/keyboard pan, zoom, clustering, map-bound calculation, point projection, and lens overlay presentation against the normalized records. A production Mapbox/MapLibre renderer can consume the same `MapViewState`, `ExchangeRecord`, and viewport-query contracts without changing the Floating Controls hierarchy.

Provider replacement is a separate Persistent Map integration concern. Floating Controls must not import a map vendor directly.

## Progressive availability

Controls render only when their prerequisites are true:

- Placement appears only if actual active-lens records support featured placement.
- Lens facets appear only when actual facet values exist.
- Off-map Only is disabled if the current lens has no off-map records.
- Mapped Only is disabled if the current lens has no mapped records.
- Center Selected Geography appears only when a geography filter exists and is disabled when no mapped record can support recentering.
- Fit Results is disabled when there are no mapped results.
- Reset North appears only when bearing is non-zero.
- Search This Area appears only after a material camera interaction marks the viewport dirty.
- Clear Searched Area appears only when a committed viewport query exists.

This is progressive availability: no visible control is left as a non-operational mock.

## Accessibility

Icon-only controls use SVG icons with explicit accessible names. Filter and Map buttons expose `aria-expanded`; 2D/3D choices use pressed state; location state is announced through a polite live region; all menu and choice rows are keyboard buttons; Escape closes the panel; child pages expose an explicit Back button; and touch targets remain approximately 44–48 px.

The map itself continues to support keyboard pan and zoom, so no map workflow depends solely on pointer gestures.

## Integration contract

```text
Universal Search ────────────────────────────────┐
                                                 │
Floating Controls                               │
  Filter hierarchy                              │
  Location / recenter                           ├── Exchange Shell State
  Map hierarchy                                 │
  Active chips                                  │
  Search this area                              │
                                                 │
Result Drawer → Filter ───── same workflow ──────┤
                                                 │
Persistent Map                                  │
  camera / bounds                               │
  markers / clusters / overlays                 │
  pointer + keyboard viewport events ───────────┘
```

RFx, Resources, Intelligence, and Capabilities consume this same hierarchy. No lens gets a separate floating-control tree, map toolbar, or filter state implementation.
