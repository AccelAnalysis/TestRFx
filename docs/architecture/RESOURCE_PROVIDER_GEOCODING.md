# Resource Provider Geocoding & Map Projection

This layer completes the map-location handoff for seeded Resource Providers without changing the RFxchange operating chassis or creating a parallel location system.

## Governing rule

A Resource Provider may have a sourced postal address without having a map marker. The shared Exchange map renders only records with a reviewed geographic point.

```text
sourced address
    ↓
geocode candidate
    ↓
accepted / review / failed
    ↓ accepted only
canonical locations.point (PostGIS)
    ↓
Resource visibility = public-location
    ↓
shared Exchange map marker
```

`public-location` therefore means **a real `locations.point` exists**. Address-only provider records remain `service-area` when a service area is available, otherwise `off-map`.

## Census geocoder adapter

`lib/server/resources/census-geocoder.ts` uses the U.S. Census Geocoder with benchmark `Public_AR_Current`.

The adapter:

1. removes secondary-unit text before matching the building street address;
2. tries the structured address endpoint first;
3. if Census returns no match, retries through `onelineaddress`;
4. automatically accepts only exactly one match with valid coordinates and matching state/ZIP;
5. returns multiple matches, state/ZIP mismatches, and invalid-coordinate results for review;
6. returns no-match/service failures as failed rather than inventing a point.

No city centroid, ZIP centroid, browser geocoder, or unsourced coordinate fallback is used.

## Persistence and provenance

`db/resource-provider-geocoding.sql` adds geocode status/provenance to `resource_ingestion_candidates` and creates `resource_location_geocodes` for canonical Location provenance.

Stored fields include:

- status: `pending | accepted | review | failed`;
- provider and Census benchmark;
- match type and matched address;
- response context;
- geocoded timestamp;
- manual verification timestamp when a reviewer explicitly accepts coordinates.

A promoted provider remains terminal for ingestion identity and cannot be reopened for promotion, but may now receive later geocode enrichment. Accepted coordinates update the existing canonical Location in place, or create the canonical Location if the promoted Exchange record did not yet have one.

## Protected runtime operations

`POST /api/resources/providers/geocode` uses the same trusted ingestion-token boundary as Resource Provider seeding.

Supported actions:

- `geocode` — run Census against a staged/promoted provider's sourced address and persist the result;
- `accept` — explicitly accept reviewer-supplied coordinates with a required documented basis.

Review/failed geocodes never update `locations.point` automatically.

For Hampton Roads:

```bash
node scripts/geocode-hampton-roads-provider-seed-pack.mjs --dry-run

RFXCHANGE_INGESTION_TOKEN=... \
node scripts/geocode-hampton-roads-provider-seed-pack.mjs \
  --base-url=https://<server-runtime>
```

The script does not promote providers and does not auto-accept review results.

## Hampton Roads initial manifest

`data/seed-packs/hampton-roads-va/geocodes.json` is a reviewed static snapshot generated from the same Census policy so the GitHub Pages TestRFx projection can display map markers without making client-side geocoding requests.

Initial automated pass:

- 30 address-ready provider candidates submitted;
- 22 accepted as one Census match with matching state/ZIP;
- 1 returned multiple matches and remains review-only;
- 7 returned no Census match and remain off-map;
- York County is held out because its source location is already marked `needs_review`;
- Hampton REaKTOR is held out because no ready sourced street address is established.

The accepted 22 are projected into the static Resource Provider records as `location` coordinates and `public-location`. Unresolved/held-out providers remain discoverable in the drawer and retain their sourced service-area treatment.

## Multiple provider locations

This PR maps one reviewed primary Location per provider record. The canonical data model already supports multiple `locations` for an Organization. A future map projection may render multiple Location markers that resolve to the same Resource Provider card/detail record; it should not duplicate the canonical Organization or provider Resource merely to create additional branch markers.
