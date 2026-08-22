# RFxchange Record Cards

Record Cards are a shared primitive of the authenticated Exchange chassis. RFx, Resources, Intelligence, and Capabilities provide governed content projections and contextual record actions; they do not create separate card systems.

## Governing boundary

**Onboarding and domain services build the record. The Exchange renders a governed projection of it.**

The normalized `ExchangeRecord` remains the data contract. It is not a mandate to display every available field on the collapsed card.

The collapsed-card hierarchy is now:

```text
Media → Identity → Essential context → Record actions → Detail
```

The interaction sequence is:

```text
See → Recognize → Select → Act → Explore
```

A collapsed card should answer only four questions:

1. What is this?
2. Who/where is it?
3. Why might I care?
4. What can I do next?

Everything else belongs in Detail.

## Shared card anatomy

The shared card owns:

- one media-first visual region
- one primary identity
- an optional short subtitle
- one concise context line
- one classification line with no more than two high-value descriptors
- a lightweight Save/Watch relationship control
- up to three governed record-specific actions
- one explicit Detail/Profile affordance
- selection state and marker synchronization

The card no longer renders paragraph summaries, unrestricted metadata arrays, relationship lists, or walls of pills.

## Media projection

Media is supplied through the normalized card projection rather than discovered ad hoc by React components.

Supported media kinds are:

- `video`
- `image`
- `visualization`
- `logo`
- governed type/category fallback

The projection may also provide organization-level hero or logo media. Resolution order is:

1. featured short video
2. featured record image / visualization
3. organization hero
4. organization logo
5. governed RFxchange type fallback

Media fields may include a poster, image source, video source, alt text, attribution, and ownership/source labeling. Domain services remain responsible for choosing which media asset is featured. The shared card does not search arbitrary organization storage.

Reference assets under `/public/exchange-media/` exist only to make TestRFx previews exercise the media-first states. They are not production provider media.

## Video behavior

Video is explicit-play only.

- posters render before playback
- no autoplay
- playback begins muted
- only one Exchange card video may play at a time
- starting another card video pauses the prior video
- scrolling a playing card substantially out of view pauses it
- video uses `preload="none"`
- missing/failed media falls back to the governed visual treatment
- playback does not change drawer height or replace card selection behavior

Production video hosting remains an integration point. The shared card consumes a URL supplied by a governed media projection; it does not create a hosting service.

## Lens-specific presentation adapters

The outer card remains identical while `buildCardPresentation()` reduces each record to the minimum useful scan information.

### RFx

- identity: RFx title
- subtitle: issuer
- context: due date + geography/distance
- classification: up to two procurement/capability descriptors

### Resources

- identity: Resource title
- subtitle: provider
- context: availability + geography/distance
- classification: up to two Resource descriptors

### Intelligence

- identity: insight/signal title
- context: geography + recency/current state
- classification: up to two signal/market descriptors

### Capabilities

- identity: organization
- subtitle: lead capability
- context: geography/distance
- classification: up to two high-value capability descriptors

`AMACS Mapped` is not repeated as discovery-card decoration when more useful capability descriptors are available. Evidence and complete capability sets remain Detail concerns.

## Record actions versus lens controls

The four-slot rail above the drawer is reserved for lens-level/general controls.

Each card separately receives `recordActions()` from the existing lens/action registry. Those actions preserve:

- visibility
- applicability
- authorization
- operational readiness
- ownership
- progressive availability

The card shows up to three governed record actions plus the shell-owned Detail/Profile affordance.

No card invents independent business logic. If an action is not operational, the existing governed disabled/unavailable behavior remains authoritative.

## Save / Watch

The star remains visually available over the media region.

Current persistence boundaries are unchanged:

- RFx Watch uses the existing RFx workspace persistence path.
- Other reference Save states remain the existing TestRFx integration seam until authenticated relationship persistence is connected.

The media-first refinement does not pretend a new persistence service exists.

## Seeded and unclaimed Resource Providers

Unclaimed listings remain governed by the provider/claim system.

The collapsed card uses a restrained `Unclaimed listing · Claim` line rather than a provenance paragraph. Full source, classification, participation policy, and claim explanation remain in Resource Detail.

Claim state is not sponsorship, verification, or recommendation.

## Selection and Detail

The media region and identity region both open the existing shared Detail controller.

Selection behavior is unchanged:

- card focus/selection updates `selectedRecordId`
- card selection highlights the corresponding marker when one exists
- marker selection reveals/selects the card
- drawer state is promoted when needed
- Detail opens without unmounting the Exchange
- closing Detail restores the existing lens/search/map/drawer/list context

Selection does not turn the card into a mini-detail page.

## Performance and accessibility

Media-first cards preserve Exchange browsing performance through:

- lazy image loading
- async image decoding
- poster-first video
- `preload="none"` video
- offscreen video pause/cleanup
- media error fallback
- unchanged drawer incremental loading

Accessibility requirements include meaningful media alt text, accessible play/pause and Save labels, keyboard focus, visible focus treatment, sufficient overlay contrast, explicit pause controls, and no important state encoded by color alone.

## Production integration points

Production domain adapters should populate the governed media projection from canonical organization/domain media services.

The shared card should remain stable as storage and media systems mature:

```text
Domain object + canonical organization
                 ↓
Domain service / media policy / authorization
                 ↓
ExchangeRecord + card/media projection + record actions
                 ↓
Shared RecordCard
  ├── MediaRegion
  ├── Identity / essential context
  ├── Save / Watch
  ├── governed RecordActionRow
  └── Detail/Profile
```

New business behavior plugs into domain services, the action registry, relationship persistence, and Detail rather than expanding collapsed-card text density or forking card implementations.
