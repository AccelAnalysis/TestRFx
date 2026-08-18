# Sliding Results Drawer

## Architectural role

The Sliding Results Drawer is a permanent primitive of the authenticated RFxchange Exchange shell. RFx, Resources, Intelligence, and Capabilities supply normalized records and governed actions; they do not create separate result pages or separate drawer implementations.

The drawer is the authoritative record surface. The map is a spatial projection of the same filtered result set and may omit records that have no public geometry.

```text
Universal search + shared drawer query
                |
                v
          Exchange records
           /          \
          v            v
   Results drawer    Map projection
   authoritative     mappable subset
```

## Mobile composition

The mobile drawer has three governed states:

- `peek` — result summary and direct expansion control while maximizing map visibility.
- `mid` — normal working state with the four-slot action rail and several result cards visible.
- `expanded` — list-first state for continuous vertical browsing while the persistent map remains mounted underneath.

The drag handle supports pointer gestures plus keyboard/non-gesture movement. `ArrowUp`, `ArrowDown`, `Home`, and `End` move between snap states, and the handle remains a normal button for touch/click users.

## Drawer-owned responsibilities

The drawer owns:

- three-state sheet mechanics and snap behavior;
- result summary and mapped/off-map counts;
- shared sort controls;
- shared shell-level filters for location, ownership, saved state, and featured state;
- mounting the governed four-slot `ActionRail`;
- vertical result scrolling;
- selected-card reveal;
- per-lens in-memory scroll restoration;
- empty, loading, refresh, offline, and error presentation contracts;
- an optional IntersectionObserver pagination seam for infinite result loading;
- mobile safe-area spacing and desktop result-panel adaptation.

The drawer does **not** own RFx response logic, resource transactions, intelligence comparisons, AMACS workflows, referral execution, authorization, or domain-specific ranking/facets.

## Query contract

`DrawerQueryState` is intentionally limited to shell-level concepts that every normalized `ExchangeRecord` can answer:

```text
sort         relevance | title | organization | geography
location     all | mapped | off-map
ownership    all | mine | others
savedOnly    boolean
featuredOnly boolean
```

Domain facets remain behind the Exchange Search / lens integration boundary. A future RFx due-date facet or AMACS taxonomy facet should not be hard-coded into the shared drawer.

The Exchange shell applies the drawer query before sending records to both the drawer and the map. This prevents the result list and map from drifting into contradictory filter states.

## Mapped and off-map records

An Exchange record does not require coordinates. Located records render in both the drawer and the map; off-map records remain first-class drawer results and are never assigned invented geometry.

The drawer reports mapped/off-map counts so the user understands why the visible list can contain more records than the map.

Sponsored placement is a separate record/card concern. When the normalized record contract gains sponsorship metadata, sponsored results must remain explicitly disclosed and must not be represented as verification, match quality, or capability strength.

## Selection and map synchronization

The shell still owns the shared `selectedRecordId`.

- Marker selection sets the shared record ID and promotes a peek drawer to `mid`.
- The drawer observes selection changes and scrolls the matching card into view.
- Card focus/select uses the same shared ID.
- Off-map records may be selected without creating a marker.

Filtering clears a selected record only when that record is no longer in the filtered result set, preventing the action rail from describing an invisible record.

## Action rail boundary

The drawer owns the **mounting location** for the four permanent action positions. The lens registry owns the actions and their `visible`, `applicable`, `authorized`, and `operational` states.

Incomplete workflows therefore remain progressively available without changing drawer geometry.

## Infinite-result boundary

`ResultsDrawer` accepts optional `hasMore`, `loadingMore`, and `onLoadMore` inputs. When present, an IntersectionObserver rooted in the result list requests the next page as the user approaches the end of the current records.

The current deterministic seed dataset does not pretend to be paginated. Production search/repository adapters should provide cursor-based continuation and append normalized records while preserving stable record identity and order.

## Result-state boundary

`DrawerResultStatus` supports:

```text
ready
loading
refreshing
error
offline
```

The reference shell currently supplies ready seed results. Production data adapters can use the same drawer without redesigning it when network-backed loading is connected.

## State continuity

Scroll offsets are retained independently for each Exchange lens while the drawer remains mounted. Drawer query state is also maintained per lens by the shell, so a Resources filter does not silently redefine the Capabilities lens.

Opening shared detail or Menu continues to overlay the mounted Exchange; neither workflow replaces the drawer.

## Responsive behavior

At desktop widths the same component becomes a persistent right-side result surface. Mobile snap state no longer changes panel height, but the same records, action rail, query state, selection, and scrolling contracts remain in use.

## Production integration points

Downstream work should connect to these seams rather than replace the drawer:

1. Exchange Search / repositories — cursor pagination, server-side ranking, domain facets, loading/error state.
2. Map adapter — mappable subset, marker/card synchronization, viewport/geographic interactions.
3. Record cards — richer lens-specific content and explicit sponsored-placement disclosure.
4. Action engine — server-derived authorization/applicability/operational readiness.
5. Detail controller — exact state restoration after full record workflows.
6. Analytics/events — result impressions, scroll depth, filter/sort use, selection, and detail opens.

The governing rule is unchanged: **the drawer is a chassis component; lenses plug into it.**
