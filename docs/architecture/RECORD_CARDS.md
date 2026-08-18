# RFxchange Record Cards

Record Cards are a shared primitive of the authenticated Exchange chassis. RFx, Resources, Intelligence, and Capabilities provide record content and business workflows; they do not create separate card systems.

## Governing boundary

**Onboarding builds the record. The Exchange renders the record.**

Identity and onboarding establish organization identity, geography, profile information, capability enrichment, evidence, discoverability metadata, and publication readiness. Once published, domain objects are projected into the shared `ExchangeRecord` contract and rendered by the Exchange card system.

## Follow-up review

The first Record Cards implementation correctly established one shared card component, mapped/off-map behavior, selected state, placement treatment, card-to-detail navigation, and the card/action-rail boundary. The follow-up review found missing behavior from the source architecture:

1. record detail was flat and did not carry the source-defined child/grandchild workflow hierarchy;
2. production Exchange pages and `/api/exchange/results` still depended on deterministic fixture records;
3. Save/Watch/Track/Follow and shared workflow execution used client/reference state rather than authenticated persistence;
4. Resource and Intelligence forms reported reference-session mutations instead of writing canonical domain tables;
5. RFx detail/lifecycle behavior still depended on reference data instead of `rfx_records`, pursuits, and responses;
6. Capability evidence/publishing did not use the canonical capability record;
7. Login used a reference identity gateway and did not establish the same runtime session required by the Exchange.

This implementation closes those gaps without adding workflow children not present in the source diagrams.

## Shared card contract

The shell owns the stable interaction contract:

- canonical record ID, record type, and organization identity;
- title, summary, geography, domain metadata, and optional map coordinates;
- server-derived own-organization context and access policy;
- persistent relationship state;
- card projection for eyebrow, media, classifications, status, relationships, placement, context, availability, distance, and density;
- standard and compact density;
- loading, refreshing, error, offline, restricted, and unavailable states;
- card-to-detail and marker/card selection synchronization;
- lightweight Save/Favorite control;
- activity events used for Recently Viewed treatment.

Media URLs come from canonical record metadata. Failed media falls back to the domain/category treatment instead of collapsing the card.

## True hierarchical workflow navigation

Opening a card creates a nested detail-navigation state. The browser URL retains the selected record and a validated `flow` path. Deeper navigation pushes browser history; Back moves up one hierarchy level before closing the record. The shell therefore preserves record, lens, search, map, drawer, and list context.

Only source-defined nodes are represented.

### RFx — own organization

```text
Create RFx / Opportunity
└── Draft / Save / Publish

Manage RFx
├── Invite Team / Collaborators
├── Track / Watch Status
└── View Responses / Matches
    └── Decision / Next Step
        ├── Update
        ├── Close
        ├── Award / Advance
        └── Refer from context
```

### RFx — other organization

```text
View RFx Detail
Respond / Submit
Team / Join / Collaborate
Watch / Follow
Refer Relevant Organization
Outcomes
├── Saved
├── Submitted
├── Teamed
└── Referred
```

### Resources — own organization

```text
Offer Resource
└── Offer Resource modal
Edit Resource
└── Manage / Edit Resource
Share
└── Share / send resource
Save / Archive
└── Save or Archive action
```

### Resources — other organization

```text
Request Resource
└── Request Resource modal
View Resource Detail
Share
└── Share / send to another organization
Save
└── Save / follow
Refer from resource result or detail
└── Referral modal
    └── Recipient referral policy / fee
        └── Track in Menu > Referrals Management
Lifecycle
├── Create / Offer
├── Visible in list / map
├── Viewed / saved / shared
├── Requested / connected
└── Archived / retained
```

### Intelligence — own organization

```text
Add Insight
└── Insight record updated
Edit Insight
└── Insight record updated
Compare
└── Analyze patterns / compare intelligence
Track
└── Follow changes / watch intelligence activity
```

### Intelligence — other organization

```text
View Insight Detail
└── Review intelligence context
Add Note
└── Contribute note / commentary
Compare
└── Compare external intelligence
Follow / Track
└── Monitor updates / changes
Outcomes
├── Decision Support
├── Opportunity / Capability Matching
├── Referral Trigger (Cross-Lens)
│   └── Create Referral
└── Save / Watch / Return to Exchange
```

### Capabilities — own organization

```text
View current capability profile
└── Manage Capabilities
    ├── AI → AMACS Mapping
    ├── Add / Edit Evidence
    ├── Identify Capability Gaps
    └── Save / Publish updates
        └── Capability profile available in Exchange
```

### Capabilities — other organization

```text
Browse / search organizations
└── View Capabilities
    └── Match to RFx / requirement
        └── Decide next action
            ├── Refer
            ├── Save / Follow
            └── Open detail
                └── Capability detail / supporting evidence
```

## Production runtime

Production Exchange pages no longer initialize from `exchangeSeed`, Intelligence fixtures, RFx catalog fixtures, or capability reference profiles. They load the canonical PostgreSQL/PostGIS repository. Fixture records are generated only by the GitHub Pages preparation step and run in read-only preview mode.

The runtime requires:

- `DATABASE_URL` for PostgreSQL/PostGIS;
- the canonical, identity, domain, shared-workflow, and runtime SQL migrations;
- `RFXCHANGE_APP_ORIGIN`;
- `RFXCHANGE_IDENTITY_DELIVERY_URL` and optional `RFXCHANGE_IDENTITY_DELIVERY_TOKEN` for the production passwordless delivery adapter;
- an opaque `rfx_session` cookie whose SHA-256 hash resolves to `app_sessions`;
- an active user and organization membership.

Login now creates a single-use database challenge and delegates delivery to the configured production delivery endpoint. The raw challenge and session tokens are never persisted. Consuming the challenge creates the same `rfx_session` used by Exchange repositories and server-authorized workflows.

Authenticated Exchange routes and `/api/exchange/results` require a valid session and active organization. There is no fake/reference actor fallback and production does not silently replace unavailable services with fixture data.

## Durable record relationships

`record_relationships` plus the compatibility `favorites` projection persist Save, Watch, Track, and Follow. Every relationship mutation emits an `activity_events` record. Card context can derive Saved, Watched/Followed, Recently Viewed, and unread-alert state from persisted data.

## Durable shared workflows

The shared workflow service persists:

- share-link executions;
- referrals and referral events;
- teaming/connection requests;
- workflow execution/audit records;
- relationship mutations.

## Durable RFx workflows

The RFx source-defined paths are backed by canonical RFx tables:

- Create RFx / Opportunity;
- Draft / Save / Publish;
- Update;
- Close;
- Respond / Submit;
- View Responses;
- Award / Advance;
- Watch and teaming/referral handoffs.

RFx responses write `rfx_responses` and pursuit state writes `rfx_pursuits`. For records whose authoritative issuer requires external submission, RFxchange does not pretend to submit externally: a submitted state requires an external confirmation/reference.

`View Responses / Matches` shows real recorded responses. The “Matches” portion remains explicitly unavailable until the governed AMACS/matching provider exists; no deterministic fixture match is substituted.

## Durable Resources workflows

Offer, Edit, Request, and Archive write canonical `exchange_records`, `resources`, and `resource_requests` tables. Resource forms no longer create local `res-local-*` records or use hard-coded reference geography defaults.

## Durable Intelligence workflows

Add Insight, Edit Insight, Add Note, and Track write canonical Intelligence/relationship data with authenticated actor and organization context. Reference comparison was removed from production. Compare remains unavailable until a governed analytics/matching provider exists.

## Durable Capabilities workflows

Capability detail and supporting evidence read the canonical capability record. Add/Edit/Remove Evidence updates `capabilities.evidence` and evidence state; Save/Publish updates the canonical Exchange record and emits activity events. Existing accepted AMACS IDs are preserved exactly as stored.

The following source-defined capability behaviors remain intentionally unavailable because the repository does not contain an authoritative provider for them:

- AI → AMACS Mapping;
- Identify Capability Gaps;
- Match to RFx / requirement.

They remain visible in the source-derived hierarchy with explicit unavailable reasons. RFxchange does not synthesize AMACS candidates, gap determinations, or match scores.

## Located and off-map records

The drawer is authoritative. A record with coordinates participates in marker/card synchronization; a record without coordinates remains a first-class drawer result and opens the same detail surface. Product domains must not discard valid results merely because they have no point location.

## Sponsored, alert, recommendation, and recently-viewed context

Sponsorship is a placement treatment on a canonical record, not a separate identity. Alerts derive from unread notifications and Recently Viewed derives from `activity_events`. The contract also supports recommendation context, but production does not fabricate recommendation records; a real recommendation provider must supply them first.

## Own versus other organization

`ownedByViewer` is derived from the authenticated user's active organization membership. `ExchangeRecord.access` supplies server-derived policy hints to the card/action layer, while authoritative write checks remain in server services.

## Interaction rules

- Selecting a map marker selects and reveals its card.
- Selecting/focusing a card updates shared selection state.
- Opening the card launches the shared detail surface without unmounting the Exchange.
- Returning from detail preserves lens, search, map, drawer, selection, list context, and nested workflow path.
- Save/Favorite is a lightweight record-local control backed by the relationship repository.
- Primary business workflows remain governed by the four-slot action rail and source-derived detail hierarchy.
- Long-press or gesture-only behavior is never required for a primary workflow.
- An unavailable production service is presented as unavailable; it is never replaced by fixture success.

## Runtime flow

```text
Authenticated session + active organization
   ↓
PostgreSQL / PostGIS domain records
   ↓
Repository + policy projection
   ↓
ExchangeRecord + card projection
   ↓
Shared RecordCard + map selection
   ↓
Nested detail workflow tree + action rail
   ↓
Relationship / RFx / Resource / Intelligence / Capability / shared workflow service
   ↓
Canonical persistence + activity events
```

The card component remains stable as domain capabilities mature. New business behavior plugs into governed repositories, the action registry, and the source-defined workflow tree rather than forking the shared card shell.
