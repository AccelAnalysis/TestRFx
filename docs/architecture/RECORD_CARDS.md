# RFxchange Record Cards

Record Cards are a shared primitive of the authenticated Exchange chassis. RFx, Resources, Intelligence, and Capabilities provide record content; they do not create separate card systems.

## Governing boundary

**Onboarding builds the record. The Exchange renders the record.**

Identity and onboarding establish organization identity, geography, profile information, capability enrichment, AMACS alignment, evidence, discoverability metadata, and publication readiness. Once published, those domain objects are projected into the shared `ExchangeRecord` contract and rendered by the Exchange card system.

## Shared card contract

The shell owns the stable interaction contract:

- canonical record ID and record type
- organization identity
- title, summary, geography, and domain metadata
- optional map coordinates
- own-organization context
- saved state
- card projection for eyebrow, media, classifications, status, relationships, placement, and distance
- card-to-detail navigation
- marker/card selection synchronization
- lightweight save/favorite control

The optional `card` projection intentionally keeps display concerns out of raw domain tables while allowing each domain adapter to provide the content the shared card needs.

## Lens variants

### RFx

Typical content includes solicitation type, issuer, geography, due date, status, capability match, response/team relationship state, and watch/save state.

### Resources

Typical content includes offer/request context, provider, availability, category, geography, saved state, and sponsored placement when applicable.

### Intelligence

Typical content includes signal/insight type, source or contributor, geography, market/capability classification, recency, and tracking/following state. Intelligence may be geographic without representing a single point marker.

### Capabilities

Typical content includes organization identity, AMACS-aligned capabilities, evidence or publication status, geography/service area, specialties, and discovery relationships such as following or referral state.

## Located and off-map records

The drawer is authoritative. A record with coordinates participates in marker/card synchronization; a record without coordinates remains a first-class drawer result and opens the same detail surface. Product domains must not discard valid results merely because they have no point location.

## Sponsored records

Sponsorship is a placement treatment on a normal Exchange record, not a separate record identity. Sponsored cards remain clearly labeled and route to the same canonical detail destination as their underlying record.

## Own versus other organization

`ownedByViewer` is the current chassis projection for own-organization context. Production implementations should resolve ownership and authorization from authenticated organization membership on the server. The card may show ownership state, while the four-slot action rail remains the governed home for management or discovery actions.

## Interaction rules

- Selecting a map marker selects and reveals its card.
- Selecting/focusing a card updates shared selection state.
- Opening the card launches the shared detail surface without unmounting the Exchange.
- Returning from detail preserves lens, search, map, drawer, selection, and list context.
- Save/favorite is a lightweight record-local control; primary business workflows remain in the four-slot lens action rail.
- Long-press or gesture-only behavior must never be required for a primary workflow.

## Production integration points

The reference chassis keeps save state in memory. Production should connect it to the relationship/favorites repository for the authenticated user. Likewise, domain services should emit normalized `ExchangeRecord` projections rather than allowing React components to query RFx, Resource, Intelligence, or Capability persistence directly.

Recommended flow:

```text
Domain object
   ↓
Domain service / policy
   ↓
ExchangeRecord + card projection
   ↓
Search / results API
   ↓
Shared RecordCard
   ↓
Selection + map + action rail + detail
```

The card component should remain stable as domain workflows mature. New business behavior plugs into the domain adapters, action registry, relationship services, and detail content rather than forking the shared card shell.
