# Resources lens integration

The Resources experience is a lens inside the authenticated RFxchange Exchange chassis. It does not own a second map, search bar, result drawer, card system, detail controller, or bottom navigation.

## Shell contract

When `resources` is active, the chassis keeps the persistent Exchange composition mounted and injects Resource-specific records, facets, action resolution, and detail/workflow content.

```text
Exchange shell
├── Persistent map                 shared
├── Universal search               shared, Resources placeholder/corpus
├── Floating controls              shared
├── Three-state result drawer      shared
│   ├── Resource facets            Resources adapter
│   ├── Four action positions      shared positions / Resources actions
│   └── Resource record cards      shared cards / Resources projection
├── Detail controller              shared / Resources detail body
├── Bottom navigation              shared
└── Shared services
    ├── Saved & Watchlist
    ├── Referrals
    ├── Notifications
    ├── Authorization
    └── Activity / audit
```

The result drawer remains authoritative: a Resource can be visible in the list without having a map location. The reference data includes mapped, off-map, owned, external, and sponsored examples.

## Resource projection

A Resource remains an `ExchangeRecord` and adds a typed `resource` projection containing category, availability, capacity, service area, visibility, terms, lifecycle status, and sponsored-placement state. The production domain can be richer; the shell only receives what it needs to render and govern interaction.

## Ownership-aware action rail

The four chassis positions are stable while the action definitions change with ownership.

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Offer | Request |
| 2 | Edit | View |
| 3 | Share | Share |
| 4 | Archive | Save |

`Offer`, `Edit`, `Request`, `Archive`, `View`, `Save`, and `Share` are operational in the reference client implementation. Production authorization and persistence still belong behind authenticated server/domain services.

## Discovery controls

Resources supplies a drawer toolbar for:

- category
- availability
- geography / map presence
- ownership view and sort

Universal search remains the chassis search control and searches the normalized record projection. Resource filters are retained while the user switches to another lens and returns.

## Workflows

### Offer

The Offer surface captures Resource identity, category, description, availability, capacity, geography, service area, map visibility, and terms. The reference implementation publishes into client state. Production should replace that mutation with a Resources service/repository call and geocoding/organization-location policy where needed.

### Edit / archive

Owned Resources can be edited or archived. Archiving removes the Resource from active discovery but preserves the lifecycle concept for restoration/audit in the production domain.

### Request

Requests are modeled as a transaction against an offered Resource rather than as a second page architecture. The production data target is `resource_requests`, relating the Resource, requester organization, provider organization, requesting user, request details, and request status.

### Save and share

Save uses the common Exchange saved-record behavior. Share uses the Resource deep link. Production persistence for favorites remains a shared service concern.

### Cross-lens referral

Referral is intentionally not a fifth Resources action slot. Resource Detail exposes the integration point, while composition, recipient policy/fee handling, tracking, and management remain owned by the shared Referral workflow and Menu → Referrals Management.

## State continuity

The chassis now retains search, drawer state, and selected record separately for every lens. Therefore a user can move `Resources → RFx → Resources` and recover the prior Resource working context. Resource facet/sort state is also retained while the shell remains mounted.

## Production boundaries

The reference implementation proves the UI/domain contract, not production completion. Replace client-state mutations with:

```text
Resources lens
   ↓
Exchange API / BFF
   ↓
Resources service
   ├── offer repository
   ├── request repository
   ├── availability / fulfillment
   ├── authorization
   ├── activity events
   └── notifications
   ↓
PostgreSQL / PostGIS + object storage
```

Mapbox/MapLibre, authentication, server-side permissions, durable favorites, referral execution, object storage, provider notifications, and fulfillment remain chassis/shared-service integration points.
