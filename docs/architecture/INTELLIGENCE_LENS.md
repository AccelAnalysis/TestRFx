# Authenticated Exchange → Intelligence Lens

## Purpose

The Intelligence lens is the analytical projection of the RFxchange Exchange. It lets participants discover, review, contribute, compare, annotate, and track market intelligence without leaving the persistent map-first operating chassis.

It is **not** a separate BI application. The lens reuses the same persistent map, Universal Search, sliding result drawer, four-slot action rail, Exchange cards, detail controller, bottom navigation, organization context, and cross-lens services used by RFx, Resources, and Capabilities.

## Source architecture implemented

The RFxchange Intelligence flow defines:

1. Open the RFxchange shell.
2. Select the Intelligence lens.
3. Use Search / Filter / Map / Result Sheet.
4. Branch contextual actions by record ownership.

### Own record actions

| Position | Action | Source trigger | Reference implementation |
| --- | --- | --- | --- |
| 1 | Add Insight | Modal | Working reference-session contribution form |
| 2 | Edit Insight | Menu | Working managed edit surface over the mounted Exchange |
| 3 | Compare | Modal | Working two-record reference comparison |
| 4 | Track | Action | Working mounted-session tracking toggle |

### Other record actions

| Position | Action | Source trigger | Reference implementation |
| --- | --- | --- | --- |
| 1 | View Insight Detail | Menu | Shared Exchange detail controller |
| 2 | Add Note | Modal | Working reference-session note form |
| 3 | Compare | Modal | Working two-record reference comparison |
| 4 | Follow / Track | Action | Working mounted-session follow toggle |

The physical action positions remain part of the chassis. Intelligence supplies the business semantics through the governed `LensAction` registry.

## Persistent composition

```text
Authenticated Exchange Shell
│
├── Universal Search
├── Persistent Map
│   ├── mapped Intelligence records
│   ├── selected-record synchronization
│   └── reference signal overlay / production map-layer seam
│
├── Sliding Results Drawer
│   ├── result count
│   ├── sort/filter positions
│   ├── four contextual actions
│   └── infinite vertical Intelligence card stream
│
├── Shared Detail Controller
│   ├── Intelligence context
│   ├── source and provenance
│   ├── related capabilities / organizations
│   ├── notes
│   └── decision pathways
│
└── Bottom Navigation
    └── Intelligence
```

The drawer remains the authoritative result surface. Intelligence records without coordinates remain discoverable and actionable in the list without manufacturing a map marker.

## Reference data and production truth

The current TestRFx implementation deliberately uses deterministic records and mounted client state to prove the operating contract.

The included intelligence fixtures are **not production market truth**. They must not be interpreted as a census, verified market measurement, economic forecast, or authoritative statement about Hampton Roads or any other geography.

Production Intelligence must preserve at least:

- source identity;
- source class;
- publisher/author where applicable;
- observation period;
- retrieval/freshness timestamps;
- geography/coverage;
- methodology/transformation metadata;
- rights/licensing context;
- participant visibility/permissions;
- revision history;
- audit/activity events.

Missing data must remain missing rather than silently becoming zero.

## Intelligence record projection

The shell continues to consume the common `ExchangeRecord` contract. Rich Intelligence data stays behind the domain boundary.

```text
Intelligence source / observation / derived signal
                    │
                    ▼
          Intelligence domain service
                    │
          ┌─────────┴──────────┐
          │                    │
  rich Intelligence data   ExchangeRecord
          │                    │
          │                    ▼
          │              Exchange shell
          │
          └────────► detail / provenance service
```

The deterministic `lib/exchange/intelligence.ts` fixture demonstrates this separation. A production repository or Intelligence service can replace the fixture without replacing the map, drawer, navigation, or card framework.

## Map behavior

The same chassis map is retained when the lens changes to Intelligence.

The reference implementation adds an explicitly labeled **reference intelligence signal overlay** and renders geolocated Intelligence records through the shared marker contract. Off-map records remain list-only.

Production map integration can later supply governed point, polygon, choropleth, heat, temporal, or density layers through the map adapter boundary. A heat-style visual must not be treated as analytically meaningful unless the underlying dataset, aggregation rule, cohort/privacy rule, and provenance are real and authorized.

## Contribution workflow

`Add Insight` and `Edit Insight` currently mutate mounted client state only. They prove the interaction contract while making the persistence boundary explicit.

Production contribution should resolve:

```text
Authenticated session
      ↓
Active organization
      ↓
Role / permissions
      ↓
Contribution policy
      ↓
Validated insight
      ↓
Canonical Intelligence repository
      ↓
Source/provenance + activity event
```

The UI should not grant edit rights from a client `ownedByViewer` flag. Production ownership and authorization are server-authoritative.

## Notes

Notes are intentionally separate from the source Intelligence record. A note adds context or commentary without rewriting the originating signal.

Production note visibility supports the modeled states:

- `personal`;
- `organization`;
- `shared`.

The default production posture should avoid public/shared disclosure unless the user explicitly selects a permitted sharing scope.

## Comparison

The comparison surface can compare two visible Intelligence records across dimensions that both records actually expose. The current reference comparison shows geography, signal type, observed period, and source.

Production comparison can expand to organizations, geographies, capabilities, time windows, and governed metrics. It should be computed from canonical source records rather than persisting an inferred comparison as immutable market truth by default.

## Track / Follow

Track and Follow use the same shell action position but represent relationship intent around Intelligence.

The current reference toggles the normalized `saved` state in the mounted Exchange. Production uses the `intelligence_tracking` persistence target and should emit activity events that can feed one shared notification system.

Potential production events include:

- tracked insight changed;
- new supporting source added;
- related RFx appeared;
- related capability/organization changed;
- tracked metric crossed an authorized threshold.

## Decision pathways

The source flow identifies four downstream outcomes:

1. **Decision Support** — use curated/comparative intelligence to inform a decision.
2. **Opportunity / Capability Matching** — move from observed demand/supply context to relevant RFx or capabilities.
3. **Referral Trigger (Cross-Lens)** — hand the referenced Intelligence record to the shared referral engine.
4. **Save / Watch / Return to Exchange** — maintain context and continue through other lenses.

These are cross-lens outcomes, not new bottom-navigation destinations. Referrals remain a shared workflow managed through Menu.

## Persistence target

`db/intelligence.sql` extends the base chassis schema with:

- richer observation windows and provenance on `intelligence_records`;
- `intelligence_sources`;
- `intelligence_notes`;
- `intelligence_tracking`;
- `intelligence_relationships`.

The base `exchange_records` table remains the shared Exchange identity. Intelligence-specific tables extend that identity rather than creating a parallel record universe.

## Privacy and aggregation rules

Production derived Intelligence must be privacy-safe. In particular:

- participant-network activity must not be described as the whole economy;
- small cohorts must not expose private organization behavior through aggregation;
- private/off-platform sources require explicit rights and visibility controls;
- source and derived values must remain distinguishable;
- paid membership must not buy verification, endorsement, substantive analytical ranking, or false confidence.

## Progressive availability

The Intelligence lens remains present in the bottom navigation even when a downstream production integration is incomplete. A missing production service should result in a truthful unavailable state, not a fabricated dataset or fake completed action.

Reference-session interactions in TestRFx exist to prove the contract. They are labeled as reference behavior and should be replaced behind the same seams by production repositories, datasets, authorization, notifications, object storage, and referral services.

## Integration points

Production work plugs into the established chassis through:

- **Identity / Policy** — authenticated user, active organization, role, permissions;
- **Exchange Search** — Intelligence corpus, facets, geography, recency, source filters;
- **Map Adapter** — point/heat/polygon/temporal layers;
- **Intelligence Repository** — insights, observations, datasets, provenance;
- **AMACS / Capability Service** — related capabilities and capability concentration;
- **RFx Service** — demand/opportunity relationships;
- **Resources Service** — supply/resource relationships;
- **Referral Engine** — cross-lens referral creation;
- **Activity / Notification Service** — tracking/follow updates;
- **Object Storage** — source artifacts/attachments where authorized.

The governing dependency direction is always:

> Intelligence plugs into the RFxchange operating chassis; it does not recreate the chassis.
