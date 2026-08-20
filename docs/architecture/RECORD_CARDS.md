# RFxchange Record Cards

Record Cards are a shared primitive of the authenticated Exchange chassis. RFx, Resources, Intelligence, and Capabilities provide record content and contextual actions; they do not create separate card systems.

## Governing boundary

**Onboarding builds the record. The Exchange renders the record.**

Identity and onboarding establish organization identity, geography, profile information, capability enrichment, AMACS alignment, evidence, discoverability metadata, and publication readiness. Once published, domain objects are projected into the shared `ExchangeRecord` contract and rendered by the Exchange card system.

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
- lightweight star/save/watch/follow control
- contextual record-action row

The optional `card` projection keeps display concerns out of raw domain tables while allowing each domain adapter to provide the content the shared card needs.

## Interaction hierarchy

The card deliberately separates four behaviors:

1. **Card body** → opens the shared detail surface for that exact record.
2. **Star** → saves/watches/follows that record.
3. **Record Action Row** → performs contextual business actions on that record.
4. **Metadata chips** → communicate status/classification/context and are not substitutes for action buttons.

This separation prevents the lens rail from becoming record-dependent and removes ambiguity such as a generic `View Detail` command before a record has actually been selected.

## Record action row

Cards show up to three compact, touch-friendly actions. The primary record action receives modest visual emphasis; secondary actions remain quieter. A detail surface may expose up to four contextual actions when the domain has a legitimate fourth command.

Current reference actions include:

### RFx

- External: Respond (when authorized), Team, Share
- Owned: Manage, Invite Team, Share

Watch is handled by the card star. Detail is opened by the card body.

### Resources

- External: Request (when applicable/authorized), Share
- Owned: Edit, Archive, Share

A viewer who is not a Resource Provider does not gain provider-side record commands merely by entering Resources.

### Intelligence

- External: Add Note, Compare, Share
- Owned contributor: Edit, Compare, Share

### Capabilities

- External: Match RFx, Refer, Share
- Owned manager: Manage, AI → AMACS, Evidence, with Gaps available in detail

Record actions are resolved from the active lens, the record relationship, and `ExchangeViewerContext`. Production must source viewer/organization eligibility and permissions from authenticated server policy rather than client assumptions.

## Lens variants

### RFx

Typical content includes solicitation type, issuer, geography, due date, status, capability match, response/team relationship state, and watch/save state.

### Resources

Typical content includes offer/request context, provider, availability, category, geography, saved state, and sponsored placement when applicable.

### Intelligence

Typical content includes signal/insight type, source or contributor, geography, market/capability classification, recency, and tracking/following state. Intelligence may be geographic without representing a single point marker.

### Capabilities

Typical content includes organization identity, AMACS-aligned capabilities, evidence or publication status, geography/service area, specialties, and discovery relationships such as following or referral state.

## Text-density rule

The card should not become a wall of pills. The reference implementation limits visible classification, metadata, and relationship tokens and restores real buttons for actions. Additional metadata belongs in detail rather than being promoted into pseudo-controls.

## Located and off-map records

The drawer is authoritative. A record with coordinates participates in marker/card synchronization; a record without coordinates remains a first-class drawer result and opens the same detail surface. Product domains must not discard valid results merely because they have no point location.

## Sponsored records

Sponsorship is a placement treatment on a normal Exchange record, not a separate record identity. Sponsored cards remain clearly labeled and route to the same canonical detail destination as their underlying record.

## Own versus other organization

`ownedByViewer` is the current chassis projection for own-organization context. Production implementations should resolve ownership and authorization from authenticated organization membership on the server. Ownership affects the card's record actions, not the four lens-level controls above the list.

## Interaction rules

- Selecting a map marker selects and reveals its card.
- Selecting/focusing a card updates shared selection state.
- Opening the card launches the shared detail surface without unmounting the Exchange.
- Returning from detail preserves lens, search, map, drawer, selection, and list context.
- Save/watch/follow is a lightweight record-local star control.
- Record business workflows live in the card action row and detail surface.
- The four-slot rail above the cards remains lens-wide and does not change when selection changes.
- Long-press or gesture-only behavior must never be required for a primary workflow.

## Production integration points

The reference chassis keeps most save state in memory; RFx Watch uses its workspace service. Production should connect relationships to authenticated repositories. Domain services should emit normalized `ExchangeRecord` projections and resolved action policy rather than allowing React components to infer authority from arbitrary table data.

Recommended flow:

```text
Authenticated viewer + active organization
                    ↓
Domain object → Domain service / policy
                    ↓
ExchangeRecord + card projection + permitted record actions
                    ↓
Search / results API
                    ↓
Shared RecordCard
        ├── card body → detail
        ├── star → relationship
        └── action row → domain workflow
```

The card component should remain stable as domain workflows mature. New business behavior plugs into domain adapters, the action registry, relationship services, and detail content rather than forking the shared card shell.
