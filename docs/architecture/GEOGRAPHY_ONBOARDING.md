# Identity & Onboarding — Geography

## Purpose

Geography establishes the spatial identity that an organization carries into RFxchange. It sits after organization selection/creation and before organization profile, capability enrichment, and Exchange-ready completion.

The Geography subsystem answers five separate questions without collapsing them into one address field:

1. **Primary geography** — where the organization enters RFxchange.
2. **Base location** — where the organization is actually based.
3. **Map placement** — the geocoded/confirmed location used by the platform.
4. **Public location visibility** — exact, approximate, or locality-only presentation.
5. **Service geography** — where the organization can provide products or services.

These outputs become one `GeographyContext` consumed downstream. The authenticated Exchange does not own onboarding Geography and the Geography route does not create another Exchange lens.

## Route and composition

The reference implementation lives at:

```text
/onboarding/geography
```

It remains inside the Identity & Onboarding shell. It deliberately does **not** render the authenticated Exchange bottom navigation, persistent result drawer, lens action rail, or domain cards.

The six internal Geography stages are:

```text
Primary locality
  -> Base location
  -> Map placement
  -> Privacy
  -> Service geography
  -> Review / validation
```

The top progress rail keeps Geography positioned in the larger onboarding lifecycle:

```text
Account -> Organization -> Geography -> Profile -> Capabilities -> Exchange ready
```

## Contracts

`lib/onboarding/geography.ts` owns the reference contracts:

- `GeographyReleaseState`
- `LocationVisibility`
- `ServiceAreaMode`
- `GeographyOption`
- `GeographyDraft`
- `GeographyContext`

The critical distinction is that primary geography, base location, public presentation, and service territory remain separate fields. Downstream RFx matching, Resources, Intelligence, Capabilities, referrals, and search should consume those separate meanings instead of inferring all geography from one address.

## Availability and server validation

The reference geography registry demonstrates the platform states:

```text
released | visible | limited | restricted
```

A locality may be visible in the network without being released for primary organization activation. `POST /api/onboarding/geography` performs the completion validation and rejects a primary geography that is not released/selectable.

This is an application-boundary demonstration. Production must replace the in-repo registry with authoritative server-side policy and must never trust a browser-supplied release state.

## Map and geocoding boundary

The route contains a provider-neutral map preview so the user begins learning the map-first visual language before entering the authenticated Exchange.

The reference preview does **not** claim to geocode the submitted street address. Production integration should resolve:

```text
entered address
  -> address autocomplete / normalization
  -> geocoder
  -> point
  -> authoritative locality intersection
  -> user confirmation
  -> persisted primary location
```

A Mapbox/MapLibre or equivalent adapter can replace the reference preview without changing `GeographyDraft` or `GeographyContext`.

## Privacy boundary

The canonical location and public projection are intentionally separate.

```text
canonical point
   |
   +-- exact public projection
   +-- approximate safe projection
   +-- locality-only projection
```

Home-based organizations can therefore retain a canonical internal location while choosing a less precise public representation. Production authorization and privacy policy are server responsibilities.

## Service geography

The reference UI supports:

- selected localities
- statewide
- nationwide
- remote / virtual

The persistence extension also supports named organization-geography relationships while the existing PostGIS `locations.service_area` field remains available for more advanced radius/custom-polygon territory later.

Service geography is independent of the primary locality release state: an organization can be based in one released market and serve additional areas.

## Persistence

`db/geography-extension.sql` extends the operating-chassis reference schema with:

- authoritative named `geographies`
- geography parent hierarchy
- adjacency
- boundary and centroid geometry
- map bounds/default camera metadata
- release state
- geography linkage and privacy on organization locations
- one primary location per organization
- `organization_geographies` relationships for primary/service/branch/other geography

The extension is kept separate from `db/schema.sql` so Geography remains a bounded integration module while the repository is evolving in parallel.

## Reference persistence and resume behavior

The current UI stores an incomplete Geography draft in `sessionStorage` so Save & Exit and browser refresh preserve progress. On successful server validation it stores the normalized `GeographyContext` under:

```text
rfxchange.geography-context
```

and returns to the onboarding shell with `?step=profile`.

This is not a production persistence claim. A real onboarding repository should persist the draft and normalized geography context against the authenticated user, active organization, lifecycle state, and audit trail.

## Operating-chassis handoff

A validated Geography context should provide downstream consumers with at least:

```text
primaryGeography
primaryLocation
publicLocation.visibility
serviceArea
availabilityState
mapCamera
```

Organization Profile should consume that context rather than asking for the same base geography again. Exchange-ready completion can then activate the organization marker only after the other minimum profile/capability gates pass.

On first authenticated Exchange entry, the persistent map can initialize from `mapCamera.geographyId` while the actual map service resolves authoritative bounds/camera data.

## Production integration points

The shell and contracts are ready for these replacements without redesigning the flow:

- authenticated organization context and permissions
- authoritative FIPS/geography/boundary service
- geography release-policy service
- address autocomplete and geocoder
- locality/address mismatch resolution
- Postgres/PostGIS repositories
- audit/activity events
- organization profile handoff
- Exchange-ready marker activation
- first-Exchange camera initialization

The governing rule remains the same as the larger RFxchange chassis: Geography supplies normalized onboarding context to the platform; it does not create a parallel application or a new authenticated lens.
