# Lens Action Rail — Hierarchical Workflow Tree

## Purpose

This extension turns the Authenticated Exchange Shell's four-slot Lens Action Rail into a true hierarchical workflow controller. The four rail positions remain a chassis invariant; child and grandchild nodes come only from the RFx, Resources, Intelligence, and Capabilities source flows supplied for RFxchange.

The hierarchy does **not** add another lens, persistent toolbar, or page architecture. A rail action opens a nested sheet over the mounted Exchange, preserves map/search/drawer/detail state, and dispatches terminal nodes to the domain or shared service that owns the work.

## Shell invariant

```text
Authenticated Exchange
  └─ Sliding Results Drawer / Detail
      └─ Lens Action Rail — exactly four positions
          └─ Source-derived child workflow
              └─ Source-derived grandchild / decision / outcome
                  └─ Domain service | shared service | detail | Menu handoff
```

## RFx hierarchy

### Own organization

```text
Create RFx / Opportunity
  └─ Draft / Save / Publish
      ├─ Draft
      ├─ Save
      └─ Publish

Manage RFx
  ├─ Invite Team / Collaborators
  ├─ Track / Watch Status
  ├─ View Responses / Matches
  ├─ Decision / Next Step
  │   ├─ Update
  │   ├─ Close
  │   ├─ Award / Advance
  │   └─ Refer from context
  └─ Sticky RFx Actions
      ├─ View
      ├─ Match
      ├─ Refer
      └─ Save
```

The separate rail slots for Invite Team and Watch enter the same governed collaboration/relationship services instead of reimplementing them.

### Other organization

```text
RFx / Opportunity
  ├─ View RFx Detail
  ├─ Respond / Submit
  ├─ Team / Join / Collaborate
  ├─ Watch / Follow
  ├─ Refer Relevant Organization
  ├─ Outcome
  │   ├─ Saved
  │   ├─ Submitted
  │   ├─ Teamed
  │   └─ Referred
  └─ Sticky RFx Actions
      ├─ View
      ├─ Match
      ├─ Refer
      └─ Save
```

### RFx service implementation

`POST /api/exchange/rfx/workflows` now owns Draft, Save, Publish, Respond/Submit, View Responses/Matches, Update, Close, and Award/Advance. It persists through `exchange_records`, `rfx_records`, `rfx_responses`, match provenance, and `activity_events`.

Teaming, Watch, Refer, Match, and Save use the shared workflow service so the RFx lens does not create separate relationship/referral/collaboration repositories.

## Resources hierarchy

### Own organization

```text
Offer Resource
  ├─ Offer Resource modal
  └─ Offered resources appear in
      ├─ Map marker (if mappable)
      ├─ Infinite results list
      └─ Resource detail view

Edit Resource
  └─ Manage / Edit Resource

Share
  └─ Share menu / send resource

Save / Archive
  ├─ Save
  └─ Archive
```

### Other organization

```text
Request Resource
  └─ Request Resource modal

View Resource Detail
  ├─ Resource detail view
  └─ Cross-lens Referral Workflow

Share
  └─ Share menu / send to another organization

Save
  ├─ Save / follow action
  └─ Cross-lens Referral Workflow
```

### Resource referral children

```text
See a resource useful to another organization?
  └─ Refer from resource result or detail
      └─ Referral modal
          └─ Recipient referral policy / fee
              └─ Track in Menu > Referrals Management
```

The shared Referral modal performs the recipient-policy/fee lookup before creation. The hierarchy separately exposes the source-defined management destination so users can return to `Menu > Referrals` without adding Referrals to bottom navigation.

### Resources service implementation

`POST /api/exchange/resources/workflows` persists Offer, Edit, Request, and Archive through the canonical `exchange_records`, `resources`, and `resource_requests` model and emits activity events. Share, Save, and Referral use the shared service.

## Intelligence hierarchy

### Own organization

```text
Add Insight
  ├─ Add Insight
  ├─ Insight record updated
  └─ Outcomes / Value

Edit Insight
  ├─ Edit Insight
  ├─ Insight record updated
  └─ Outcomes / Value

Compare
  ├─ Analyze patterns / compare intelligence
  └─ Outcomes / Value

Track
  ├─ Follow changes / watch intelligence activity
  └─ Outcomes / Value
```

### Other organization

```text
View Insight Detail
  ├─ Review intelligence context
  └─ Outcomes / Value

Add Note
  ├─ Contribute note or commentary
  └─ Outcomes / Value

Compare
  ├─ Compare external intelligence
  └─ Outcomes / Value

Follow / Track
  ├─ Monitor updates and changes
  └─ Outcomes / Value
```

### Outcomes / Value

```text
Outcomes / Value
  ├─ Decision Support
  ├─ Opportunity / Capability Matching
  ├─ Referral Trigger (Cross-Lens)
  │   └─ Create Referral
  │       ├─ Cancel
  │       └─ Create Referral
  └─ Save / Watch / Return to Exchange
      ├─ Save
      ├─ Watch
      └─ Return to Exchange
```

### Intelligence service implementation

`POST /api/exchange/intelligence/workflows` persists Add, Edit, and Note through `exchange_records`, `intelligence_records`, `intelligence_sources`, and `intelligence_notes`. Compare is server-computed from canonical Intelligence records and records an activity event rather than persisting a comparison as market truth. Track/Follow, Match, Save, and Referral use shared services.

## Capabilities hierarchy

### Own organization

```text
View current capability profile
  → Manage Capabilities
  → AI → AMACS Mapping
  → Add / Edit Evidence
  → Identify Capability Gaps
  → Save / Publish updates
  → Capability profile available in Exchange
```

The four rail positions enter the relevant point in this same sequence. `Save / Publish updates` is now a durable server action through `/api/exchange/capabilities/publish` and a `publication_status` extension on `capabilities`.

### Other organization

```text
Browse / search organizations
  → View Capabilities
  → Match to RFx / requirement
  → Decide next action
      ├─ Refer
      │   └─ Cross-lens referral workflow
      ├─ Save / Follow
      │   └─ Watchlist / saved organizations
      └─ Open detail
          └─ Capability detail / supporting evidence
```

Matching, referral, and follow/save use shared services so Capabilities does not create another matching or referral repository.

### Deliberate non-mocks

The repository does not currently contain a live AMACS inference provider or production evidence object-storage/verification adapter. This PR therefore does **not** invent either service. The hierarchy and domain surfaces expose those source-defined steps, but production AI → AMACS candidate generation and evidence upload/verification remain explicit integration boundaries until a real provider is connected.

## Shared service implementation

`POST /api/exchange/workflows` is no longer a reference-event endpoint. When configured it performs durable work against PostgreSQL:

- Save / Watch / Track / Follow → `record_relationships`
- Share → tokenized, hashed `share_links`
- Refer → `referrals` + `referral_events`
- Recipient referral policy / fee → `organization_referral_policies`
- Team / Connect → `collaboration_requests`
- Match → PostgreSQL search + `match_decisions` provenance
- all successful workflows → `workflow_executions` + `activity_events`

The service fails closed when persistence or authenticated actor context is unavailable.

## Authentication and authorization

A client payload may never choose its actor or active organization.

The service boundary requires:

1. an Identity/BFF layer to validate the user session;
2. production infrastructure to strip user-supplied `x-rfx-*` actor headers;
3. the trusted layer to inject user ID, organization ID, and `x-rfx-actor-secret`;
4. `RFXCHANGE_TRUSTED_ACTOR_SECRET` to be present in production;
5. `organization_memberships` verification on every durable workflow;
6. domain ownership checks for RFx management, Resources management, and capability publication.

Non-production environments may instead supply `RFXCHANGE_DEV_USER_ID` and `RFXCHANGE_DEV_ORGANIZATION_ID` server-side.

## Database migrations required

Apply the existing canonical schema and domain extensions, including:

- `db/schema.sql`
- `db/rfx-domain.sql`
- `db/resources-extension.sql`
- `db/intelligence.sql`
- `db/shared-workflows.sql`
- `db/capability-publication.sql`

The runtime requires `DATABASE_URL`. `DATABASE_SSL=disable` may be used only where TLS is intentionally not required by the local database environment.

## What this PR intentionally does not invent

No additional children were added beyond the supplied product-flow sources. In particular, this work does not define:

- an RFx evaluation scoring methodology not present in the source;
- a referral fee formula beyond storing/retrieving the recipient policy/fee supplied by the commercial domain;
- an Intelligence forecasting algorithm;
- an AMACS inference algorithm;
- capability verification rules;
- evidence-storage semantics beyond the existing source boundary.

Those are domain/service decisions, not navigation decisions.
