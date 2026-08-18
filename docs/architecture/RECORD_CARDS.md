# RFxchange Record Cards

Record Cards are a shared primitive of the authenticated Exchange chassis. RFx, Resources, Intelligence, and Capabilities provide record content; they do not create separate card systems.

## Governing boundary

**Onboarding builds the record. The Exchange renders the record.**

Identity and onboarding establish organization identity, geography, profile information, capability enrichment, AMACS alignment, evidence, discoverability metadata, and publication readiness. Once published, those domain objects are projected into the shared `ExchangeRecord` contract and rendered by the Exchange card system.

## Review of the first Record Cards build

The first implementation correctly established one shared card component, mapped/off-map behavior, card-to-detail navigation, selected state, placement treatment, and the card/action-rail boundary. The follow-up review found four gaps against the source architecture:

1. record detail was flat and did not carry the source-defined child/grandchild workflow hierarchy;
2. production Exchange pages and `/api/exchange/results` still depended on deterministic fixture records;
3. save/watch/track/follow and shared workflow execution used client/reference state rather than authenticated persistence;
4. Resource and Intelligence forms reported successful reference-session mutations without writing canonical domain tables.

This implementation closes those gaps without adding workflow children not present in the source diagrams.

## Shared card contract

The shell owns the stable interaction contract:

- canonical record ID and record type;
- canonical organization identity;
- title, summary, geography, and domain metadata;
- optional map coordinates;
- server-derived own-organization context and access policy;
- persistent relationship state;
- card projection for eyebrow, real media, classifications, status, relationships, placement, context, availability, distance, and density;
- card-to-detail navigation;
- marker/card selection synchronization;
- lightweight save/favorite control;
- activity events used for recently-viewed treatment.

The optional `card` projection keeps display concerns out of raw domain tables while allowing each domain adapter to provide the content the shared card needs.

## True hierarchical workflow navigation

Opening a card creates a nested detail-navigation state. The browser URL retains the selected record and a validated `flow` path. Back moves up one hierarchy level before closing the record, so the shell can preserve record, map, search, drawer, and list context.

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

## Real runtime services

Production Exchange pages no longer initialize from `exchangeSeed`, `intelligenceSeed`, or capability reference fixtures. They load the canonical PostgreSQL/PostGIS repository. Static fixture records are generated only by the GitHub Pages preview preparation step and are rendered in read-only preview mode.

The runtime requires:

- `DATABASE_URL` for PostgreSQL/PostGIS;
- `db/schema.sql` plus domain/shared-workflow/runtime migrations;
- an opaque `rfx_session` cookie whose SHA-256 hash resolves to `app_sessions`;
- a real user and active organization membership.

There is no fake/reference actor fallback. If the database or authenticated session is unavailable, writes fail explicitly instead of mutating client memory.

### Durable record relationships

`record_relationships` and the compatibility `favorites` projection persist Save, Watch, Track, and Follow. Every relationship mutation emits an `activity_events` record. Card context can therefore derive Saved, watched/followed, recently viewed, and unread-alert state from persisted data.

### Durable shared workflows

The shared workflow API persists:

- share-link executions;
- referrals and referral events;
- teaming/connection requests;
- workflow execution/audit records;
- relationship mutations.

The matching path does **not** return a fixture score. Until a governed AMACS/matching service is configured, the source-defined Match workflow is shown as unavailable.

### Durable Resources workflows

Offer, Edit, Request, and Archive write canonical `exchange_records`, `resources`, and `resource_requests` tables. Resource forms remain UI surfaces, but they no longer create `res-local-*` records in React state.

### Durable Intelligence workflows

Add Insight, Edit Insight, and Add Note write `exchange_records`, `intelligence_records`, and `intelligence_notes` with authenticated actor/organization context. Reference comparison is removed from production; Compare remains unavailable until the governed analytics/matching service exists.

### Capabilities and RFx lifecycle gaps

The source explicitly requires AMACS mapping, capability evidence/gaps/publishing, and deeper RFx create/respond/lifecycle decisions. The repository has persistence foundations for several of these, but the production command/provider contracts are not complete in this branch. Those actions remain visible with explicit unavailable reasons. They do not simulate success, fabricate AMACS candidates, or generate deterministic matching truth.

## Located and off-map records

The drawer is authoritative. A record with coordinates participates in marker/card synchronization; a record without coordinates remains a first-class drawer result and opens the same detail surface. Product domains must not discard valid results merely because they have no point location.

## Sponsored, alert, recommendation, and recently-viewed context

Sponsorship is a placement treatment on a normal Exchange record, not a separate record identity. The card contract also accommodates the source-required recommendation, alert, and recently-viewed contexts. The repository currently derives alerts from unread notifications and recently-viewed state from `activity_events`. It does not fabricate recommendation records; a production recommendation service must provide them before that context appears.

## Own versus other organization

`ownedByViewer` is derived by the server from the authenticated user's active organization membership. `ExchangeRecord.access` supplies the card/action layer with server-derived policy hints, while authoritative write checks still occur in server services.

## Interaction rules

- Selecting a map marker selects and reveals its card.
- Selecting/focusing a card updates shared selection state.
- Opening the card launches the shared detail surface without unmounting the Exchange.
- Returning from detail preserves lens, search, map, drawer, selection, list context, and nested workflow path.
- Save/favorite is a lightweight record-local control backed by the relationship repository.
- Primary business workflows remain governed by the action rail and source-derived detail hierarchy.
- Long-press or gesture-only behavior is never required for a primary workflow.
- An unavailable production service is presented as unavailable; it is never replaced by fixture success.

## Runtime flow

```text
PostgreSQL / PostGIS domain object
   ↓
Authenticated repository + policy
   ↓
ExchangeRecord + card projection
   ↓
Exchange Results API
   ↓
Shared RecordCard
   ↓
Selection + map + action rail + nested detail navigation
   ↓
Authenticated relationship / domain / shared workflow service
   ↓
Canonical persistence + activity events
```

The card component remains stable as domain workflows mature. New business behavior plugs into the governed repositories, action registry, and source-defined workflow tree rather than forking the shared card shell.
