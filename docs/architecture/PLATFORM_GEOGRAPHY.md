# Platform Geography

RFxchange uses one shared geography capability across Organizations, Resources, RFx, Capabilities, Intelligence, Search, Map, and analytics. Geography is not a Resources-only label and is not reduced to a market name such as `Hampton Roads`.

## Core hierarchy

The canonical analytical path is:

1. Country
2. State
3. Region / Market
4. County / County Equivalent
5. Place / Municipality
6. Census Tract
7. Block Group
8. Census Block

Virginia independent cities are represented at the `county_equivalent` level. `Region / Market` is an RFxchange/business-market layer and does not replace the locality returned for a physical address.

A canonical Location can therefore be physically located in a county/independent city and Census tract/block while also belonging to Hampton Roads or another RFxchange market.

## Parallel identifiers

Not every useful geography nests cleanly in the core hierarchy. The same Location or scope can also carry parallel memberships such as:

- County Subdivision
- MSA / CSA
- Planning Region
- ZIP / ZCTA
- Congressional District
- State Legislative Districts
- School Districts
- Urban Area
- Opportunity Zone
- Enterprise Zone
- HUBZone
- Foreign-Trade Zone
- Economic Development District
- Redevelopment Zone
- Industrial Development Zone
- Tax Increment Financing Zone
- other governed economic-development zones

These memberships are additive. They never replace the canonical location hierarchy.

## Address derivation

`lib/server/geography/census-profile-resolver.ts` uses the U.S. Census Geocoder geography endpoints with `layers=all` to derive Census geographies from an address or point. RFxchange persists the returned point and geography profile rather than retaining only a display label.

Organization onboarding uses the same resolver when Geography is completed. Resource Provider geocoding uses coordinate geoLookup after a provider point is accepted. RFx publication derives a performance-area profile when the issuer supplies a specific performance/service address.

A user's entered address remains distinct from the derived geographic identifiers.

## Locations

`location_geographies` attaches every core and parallel geography containing a canonical Location. `location_geography_profiles` retains the normalized profile, resolver, benchmark, vintage, and derivation method.

Existing legitimate coordinates can be enriched through:

`POST /api/geography/backfill`

The backfill endpoint is protected by `RFXCHANGE_INGESTION_TOKEN` and resolves only Locations with an existing point and no geography profile. It does not fabricate or move coordinates.

## Geographic scopes

Physical location and service/performance geography are different concepts. `geographic_scopes` supports:

- Organization service areas
- Resource service areas
- RFx performance areas
- Intelligence analysis areas
- Capability service areas

Supported scope modes are:

- canonical geographies
- specific address
- point
- radius
- polygon
- statewide
- nationwide
- remote / virtual

A scope may reference any canonical geography level or parallel identifier. A Resource located in Norfolk may therefore serve all of Virginia; an RFx issued in Richmond may have a performance address in Hampton; and an Intelligence analysis can target an Opportunity Zone without changing the analyst's organization location.

Authenticated clients persist scopes through:

`POST /api/geography/scopes`

Record targets are ownership checked against the active organization.

## Economic-development zones

Program and local boundaries are imported through:

`POST /api/geography/boundaries`

The boundary import requires source provenance: source key/name, authority, source URL when available, license/use basis, and vintage. Imported Polygon/MultiPolygon boundaries are stored in PostGIS. When a Location profile is persisted, RFxchange spatially tests that point against loaded parallel boundaries and attaches matching zones automatically.

This supports federal, state, regional, and local development designations without hard-coding one provider or one market.

## Geography catalog and analytics

Authenticated geography lookup:

`GET /api/geography/search?q=&type=&state=&economic=1`

Authenticated rollup analytics:

`GET /api/geography/analytics?type=&recordType=&economic=1&organizations=1`

Analytics aggregate canonical Exchange records and Organizations against the same geography memberships. A query can therefore roll from Block → Block Group → Tract → County Equivalent → State → Country, or analyze parallel areas such as an MSA or Enterprise Zone.

## Exchange Search and Filters

`ExchangeRecord` can carry:

- `geographyProfile` for the record's canonical Location
- `geographicScopes` for service/performance/analysis coverage
- `resource.serviceScope` for the Resource-specific coverage projection

Universal Search indexes geography names, identifiers, GEOIDs, and type labels. Search URLs support repeated `geo_id` and `geo_type` parameters. Floating Filters group available structured geography facets by level/type while retaining legacy geography labels for records that have not yet been enriched.

## Resource Provider markets

A Resource Provider seed pack market is not the physical locality. When a Hampton Roads provider is geocoded, RFxchange can attach:

- actual county/county-equivalent
- place when returned
- tract
- block group
- block
- Census parallel identifiers
- `Hampton Roads` as `region_market`
- any loaded planning/economic-development zones containing the point

This allows a provider to remain discoverable by Hampton Roads while also being filterable by its precise authoritative geography.

## Boundaries and trust

- RFxchange does not fabricate Census tract/block identifiers.
- A market label does not substitute for a physical locality.
- ZIP/ZCTA and other parallel areas are not forced into the Census containment chain.
- Economic-development zones require an identified boundary dataset and provenance.
- Address-derived geographies retain resolver/vintage metadata so future dataset updates can be audited or backfilled.
- Public map precision remains controlled separately from the canonical private location/geography profile.
