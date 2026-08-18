# Identity & Onboarding — Geography

## Purpose

Geography establishes the spatial identity that an organization carries into RFxchange. It remains inside the Identity & Onboarding shell, after Organization Selection / Creation and before Organization Profile, Capability Enrichment, and Exchange-ready Completion.

The subsystem keeps five meanings separate:

1. **Primary geography** — the authoritative locality that establishes the organization's initial RFxchange market context.
2. **Base location** — the organization's physical operating address.
3. **Map placement** — the geocoded point the user confirms.
4. **Location visibility** — whether Exchange presentation is exact, approximate, or locality-only.
5. **Service geography** — where the organization can provide products or services.

The authenticated Exchange consumes the resulting `GeographyContext`; Geography does not create an Exchange lens or a parallel map application.

## Hierarchical route tree

Geography is not a single wizard with hidden in-memory steps. Every supported child and grandchild workflow has a deep-linkable route:

```text
/onboarding/geography
|
+-- primary-locality
|   +-- /search
|   +-- /availability
|
+-- base-location
|   +-- /address
|   +-- /geocode
|   +-- /mismatch          conditional
|
+-- map-placement
|   +-- /confirm
|
+-- privacy
|   +-- /visibility
|
+-- service-geography
|   +-- /coverage
|   +-- /localities        conditional
|
+-- review
    +-- /summary
    +-- /complete
```

The tree is defined in `lib/onboarding/geography.ts`, rendered as nested navigation in the Identity shell, and used to generate static parameters for the GitHub Pages preview projection. Browser Back/Forward and direct links therefore preserve navigation semantics instead of depending on an integer step in one component.

Conditional children are source-supported workflow branches rather than invented navigation:

- `base-location/mismatch` appears only when the authoritative geocoder places the address in a different locality than the selected primary geography.
- `service-geography/localities` appears only when the organization chooses named localities as its service-coverage mode.

## Primary locality: search -> availability / boundary

The source registration flow requires geography search and market-boundary establishment. The implementation now uses the U.S. Census Bureau's TIGERweb REST services rather than an in-repository geography list.

`GET /api/onboarding/geography/search?q=...` searches current county and place layers and returns normalized `GeographyOption` records containing:

- Census GEOID
- name
- state
- geography type
- RFxchange release state
- source provenance

`GET /api/onboarding/geography/search?id=...` re-resolves a selected geography server-side and retrieves its current bounding extent in WGS84. The availability screen exposes both the Census identity and the RFxchange activation state before allowing continuation.

### Release policy

Census answers what a geography **is**. RFxchange policy separately determines whether that geography is open for primary activation.

Server configuration uses GEOIDs:

```text
RFXCHANGE_RELEASED_GEOGRAPHY_IDS
RFXCHANGE_LIMITED_GEOGRAPHY_IDS
RFXCHANGE_RESTRICTED_GEOGRAPHY_IDS
```

The default released GEOID is `51093` (Isle of Wight County, Virginia), matching the current local-first launch direction. A browser-supplied `releaseState` is never accepted as authoritative: the final completion route re-resolves the geography and reapplies server policy.

## Base location: address -> geocode -> mismatch

The source registration flow explicitly requires:

```text
physical address
  -> geocode address
  -> marker placement
```

`POST /api/onboarding/geography/geocode` uses the U.S. Census Geocoder. The server sends street, city, state, and ZIP; the response is normalized into:

```text
matchedAddress
coordinates.latitude
coordinates.longitude
county
place
source = census_geocoder
```

The response is also compared with the selected primary geography.

### Locality mismatch

When the selected primary geography and address geography differ, the workflow does not silently overwrite either one. The conditional child route offers the two previously specified resolutions:

1. **Use detected geography** — change the primary geography to the Census-resolved locality. Final completion still requires that locality to be released.
2. **Keep selected geography** — preserve the original primary geography and require an explanation for the exception.

Final completion performs the comparison again server-side.

## Map placement

The previous simulated CSS map and percentage-position marker were removed.

After Census geocoding, `/map-placement/confirm` renders a real OpenStreetMap embed centered on the returned coordinates and places the marker at that geocoded point. The user explicitly confirms placement before Geography can complete.

The map is still bounded to onboarding. It does not import the authenticated Exchange map or create a second Exchange navigation system.

## Location privacy

`/privacy/visibility` keeps canonical location separate from public presentation:

```text
exact
  -> public coordinate = confirmed geocoded point

approximate
  -> public coordinate = primary-locality centroid when available

locality_only
  -> no public organization coordinate
```

Home-based organizations receive the source-supported privacy warning, but the user retains the explicit visibility choice.

## Service geography

`/service-geography/coverage` supports the previously defined modes:

- selected localities
- statewide
- nationwide
- remote / virtual

When `selected localities` is chosen, `/service-geography/localities` uses the same Census-backed locality search instead of a static list. Service localities may be visible even when they are not released for primary RFxchange activation because service territory and launch eligibility are distinct concepts.

Final completion re-resolves selected service-geography IDs server-side so browser labels and release-state values do not become canonical truth.

## Review and completion

`/review/summary` provides a consolidated review with edit controls that return to the exact owning child workflow:

- Primary geography -> Primary locality / Search
- Base location -> Base location / Physical address
- Map placement -> Map placement / Confirm marker
- Public location -> Location privacy / Visibility preference
- Service geography -> Service geography / Coverage mode

`/review/complete` calls `POST /api/onboarding/geography`.

That endpoint does not trust the browser's derived geography. It:

1. validates the draft shape;
2. re-resolves the primary geography through Census TIGERweb;
3. re-geocodes the address through the Census Geocoder;
4. recomputes locality mismatch;
5. applies RFxchange release policy;
6. re-resolves named service localities;
7. constructs the normalized `GeographyContext`.

The returned context identifies the real services used:

```text
geography: US Census TIGERweb
geocoder: US Census Geocoder
map: OpenStreetMap
```

## GeographyContext handoff

The normalized output contains:

```text
primaryGeography
primaryLocation.matchedAddress
primaryLocation.coordinates
publicLocation.visibility
publicLocation.coordinates
serviceArea
availabilityState
mapCamera.center
mapCamera.bounds
source
```

The browser stores the validated context under `rfxchange.geography-context` so the current client-side onboarding modules can hand it to later stages without putting the physical address in a URL. The Profile handoff passes only organization identity and the primary geography name in the route.

Canonical database persistence is intentionally not fabricated here. The repository still lacks one production authenticated organization/session repository shared by all onboarding modules. Once that repository is introduced, the same server-validated `GeographyContext` maps directly to the existing Postgres/PostGIS geography schema rather than changing this route tree.

## Persistence target

`db/geography-extension.sql` remains the production relational/geospatial target for:

- named geographies and GEOIDs
- parent hierarchy and adjacency
- boundary and centroid geometry
- map bounds / camera metadata
- release state
- organization location privacy
- primary organization location
- organization primary/service/branch geography relationships

The existing base schema also provides PostGIS `geography(Point, 4326)` and `geometry(MultiPolygon, 4326)` fields for physical points and advanced service territories.

## Save / resume

Incomplete Geography state is stored in `localStorage` under a versioned draft key. This is a real browser persistence mechanism for the current client-only onboarding state and survives refresh/browser restart on the same device.

It is not described as canonical organization persistence. Canonical persistence must attach the validated geography to the authenticated organization and audit trail when the shared identity repository is available.

## Static GitHub Pages preview

GitHub Pages is a static host and therefore cannot execute the runtime Census proxy API routes. The nested Geography routes are still statically generated so the information architecture can be reviewed. Live Census search, geocoding, and completion require the server-capable Next.js runtime; the UI reports service unavailability rather than substituting mocked geography data.

## Governing chassis rule

Geography supplies normalized onboarding state to the platform. It does not change the persistent Exchange composition. Marker activation remains an Exchange-ready outcome after downstream profile/capability gates pass; completing Geography alone does not publish the organization into the Exchange.
