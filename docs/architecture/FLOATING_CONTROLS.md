# Authenticated Exchange — Floating Controls

## Purpose

Floating Controls are shared operating-chassis infrastructure layered over the persistent Exchange map. They manipulate the current Exchange view; they do not navigate away from the Exchange and they do not own lens business workflows.

Universal Search remains a sibling chassis primitive. The search surface and Floating Controls occupy one visual command zone, but their contracts remain separate.

## Mobile composition

The default map-first command zone is intentionally small:

```text
[ Universal Search                         ] [Filter] [Locate]
                                                   [2D/3D]
                                                   [Reset]

                    Persistent map

                 [ Search this area ]
                    (contextual only)
```

The result drawer remains the authoritative result surface. Sort stays in the drawer. Filter is owned by the floating control layer so the mobile shell does not expose competing filter entry points.

## Control ownership

The chassis owns:

- translucent/safe-area-aware placement over the map;
- filter launcher, active-filter badge, apply/cancel/clear lifecycle;
- current-location permission and loading state;
- map display mode (`2d | 3d`);
- reset/recenter command position;
- the future contextual `Search this area` command;
- accessibility labels, focus behavior, and responsive layout;
- per-lens filter-state persistence.

A lens or production domain service owns:

- the production filter vocabulary and facet values;
- search ranking and corpus behavior;
- actual map layers and camera implementation;
- server-side authorization and record visibility;
- domain-specific workflow actions.

## Filter contract

`ExchangeFilters` currently uses only normalized data that exists in the operating chassis:

- geography;
- organization relationship (`all | mine | others`);
- records with legitimate coordinates only;
- featured records where supported;
- lens metadata facets.

Metadata values are ORed within the metadata facet group. The other filter groups are ANDed together.

Filter state is stored independently for RFx, Resources, Intelligence, and Capabilities. Switching lenses therefore does not force incompatible RFx filters into Capabilities, but returning to a lens restores that lens's prior filter state.

This reference filter model is intentionally replaceable by production facet definitions behind the same shell lifecycle.

## Geography and location

Device location, selected geography, search geography, organization location, record coordinates, and map viewport are different concepts and must not be collapsed into one value.

The current browser geolocation control exposes:

```text
idle
requesting
located
denied
unavailable
```

The reference map only renders a viewer-location marker when the acquired coordinate falls inside the reference Hampton Roads canvas. It does not clamp an out-of-area device location onto the reference map because that would create false spatial precision.

A production Mapbox/MapLibre adapter should use the same location state to recenter the real camera.

## Map display and reset

`MapDisplayMode` is shell state. The reference canvas provides a lightweight visual 2D/3D proof, while a production adapter is responsible for real pitch/bearing/camera behavior.

Reset is also a shell command. It increments the provider-neutral reset signal and clears dirty-viewport state without coupling the control component to Mapbox/MapLibre APIs.

## Search this area

`Search this area` is intentionally contextual. It should only appear after a real map adapter reports that the user has materially changed the viewport away from the bounds represented by the current query.

The static reference canvas does not pretend to pan or zoom, so it never fabricates dirty viewport state. A production map adapter should report camera changes into the chassis and enable this control when appropriate.

## Progressive availability

Controls expose truthful local states instead of remediation loops:

- geolocation permission denied remains browseable and explains the browser-permission condition;
- geolocation unavailable does not block search, filters, cards, or drawer use;
- off-map records remain valid drawer results;
- only records with legitimate coordinates appear as map markers;
- future map-area querying stays unavailable until the provider can supply real viewport bounds.

## Accessibility

Icon-only controls have explicit accessible names. The filter button exposes `aria-expanded` and an active count, the 2D/3D control exposes pressed state, location state is announced through a polite live region, and touch targets remain approximately 44–48 px.

The filter surface uses ordinary form controls and buttons so it is keyboard operable without relying on map gestures.

## Integration boundary

```text
Universal Search ───────────────┐
                                │
Floating Controls ──────────────┼── Exchange Shell State
  Filter                         │
  Locate                         │
  Map mode                       │
  Reset                          │
  Search this area               │
                                │
Persistent Map Adapter ─────────┘
        │
        ├── camera / bounds
        ├── marker and layer rendering
        ├── current-position rendering
        └── viewport-dirty events
```

RFx, Resources, Intelligence, and Capabilities consume this same control layer. No lens should create a second mobile header, separate filter toolbar, or independent map-control implementation.
