# Sliding Results Drawer — Hierarchical Workflows

## Purpose

This document is the second-pass completion contract for **Authenticated Exchange Shell → Sliding Results Drawer**. It extends the drawer mechanics documented in `SLIDING_RESULTS_DRAWER.md` without turning RFx, Resources, Intelligence, or Capabilities into separate applications.

The governing rule remains:

```text
Persistent Exchange shell
        |
        +-- four governed action positions
                |
                +-- source-defined child workflow
                        |
                        +-- source-defined grandchild workflow / handoff / outcome
```

Only hierarchy explicitly represented in the RFxchange source diagrams is encoded. Where the source defines a child but TestRFx does not yet have a trustworthy production provider, the child remains visible as an integration boundary rather than being replaced by deterministic mock behavior.

## Nested navigation state

`DrawerWorkflowNavigator` maintains a path through `DrawerWorkflowNode` objects. The path produces breadcrumbs and Back behavior. A nested workflow overlays the still-mounted Exchange, so opening or closing it does not reconstruct the map, results, or active lens.

The shell now keeps these values independently by lens:

- universal search state;
- floating-filter state;
- drawer-query state;
- drawer snap state;
- selected record;
- map camera/geography state;
- drawer list scroll state (owned by `ResultsDrawer`).

Detail and Menu remain overlays. Changing lenses closes an open child workflow but retains the state snapshot of the lens being left.

## RFx hierarchy

### Own RFx / Opportunity

```text
Create RFx / Opportunity
├── Draft
├── Save
└── Publish

Manage RFx
├── Invite Team / Collaborators
├── Track / Watch Status
├── View Responses / Matches
└── Decision / Next Step
    ├── Update
    ├── Close
    ├── Award / Advance
    └── Refer from Context

Invite Team / Collaborators
Track / Watch Status
```

### Other organization's RFx

```text
View RFx Detail
├── Respond / Submit
│   ├── Draft response
│   └── Submit
├── Team / Join / Collaborate
├── Watch / Follow
├── Match
├── Refer Relevant Organization
├── Save
└── Outcome
    ├── Saved
    ├── Submitted
    ├── Teamed
    └── Referred

Respond / Submit
Team / Join / Collaborate
Watch / Follow
```

`Match` remains source-visible but unavailable until the production AMACS-backed matching service exists. The drawer does not use the deterministic reference matching helper as production match truth.

## Resources hierarchy

### Own resource

```text
Offer Resource
├── Visible in list / map
└── Resource detail view

Manage / Edit Resource
Share / Send Resource
Save / Archive
├── Save
└── Archive
```

### Other organization's resource

```text
Request Resource
└── Requested / connected

View Resource Detail
└── Refer from resource result or detail
    ├── Referral modal
    ├── Recipient referral policy / fee
    └── Track in Menu > Referrals Management

Share / Send to another organization
Save / Follow
```

The referral-policy child reads the recipient organization's published policy. No fee is synthesized when no policy has been published.

## Intelligence hierarchy

### Own Intelligence

```text
Add Insight
├── Insight record updated
└── Shared Intelligence outcomes

Edit Insight
├── Insight record updated
└── Shared Intelligence outcomes

Compare
├── Analyze patterns / compare intelligence
└── Shared Intelligence outcomes

Track
├── Follow changes / watch intelligence activity
└── Shared Intelligence outcomes
```

### Other Intelligence

```text
View Insight Detail
├── Review intelligence context
└── Shared Intelligence outcomes

Add Note
├── Contribute note or commentary
└── Shared Intelligence outcomes

Compare
├── Compare external intelligence
└── Shared Intelligence outcomes

Follow / Track
├── Monitor updates and changes
└── Shared Intelligence outcomes
```

The source-defined shared outcomes are:

```text
Decision Support
Opportunity / Capability Matching
Referral Trigger (Cross-Lens)
└── Referral modal / policy / Menu management handoff
Save / Watch / Return to Exchange
```

Comparison is computed from records returned by the Exchange service. It is not persisted as a new source-of-truth record unless a later approved workflow requires that behavior.

## Capabilities hierarchy

### Own organization

```text
Manage Capabilities
├── AI → AMACS Mapping
├── Add / Edit Evidence
├── Identify Capability Gaps
├── Save / Publish updates
└── Shared Capabilities outcomes

AI → AMACS Mapping
Add / Edit Evidence
Capability Gaps
```

### Other organization

```text
View Capabilities
├── Capability detail / supporting evidence
└── Shared Capabilities outcomes

Match to RFx / requirement
└── Shared Capabilities outcomes

Refer
├── Cross-lens referral workflow
└── Shared Capabilities outcomes

Save / Follow
├── Watchlist / saved organizations
└── Shared Capabilities outcomes
```

The source-defined shared outcomes are capability visibility, requirement-to-capability matching, teaming/referral opportunities, and capability intelligence inputs.

The production AMACS inference/mapping, evidence-object command path, gap analysis, publication, and requirement-match provider are not present in TestRFx. Those children are therefore explicitly unavailable rather than routed to the deterministic reference capability profile.

## Real service boundaries

### Exchange results

`GET /api/exchange/results` now uses PostgreSQL/PostGIS when `DATABASE_URL` is configured. It supplies normalized records, mapped/off-map counts, cursor continuation, organization ownership, and durable user relationship state. Production without a configured database fails closed instead of silently reverting to seed records.

The development/reference catalog remains available only in non-production/reference execution modes so the shell can be inspected without infrastructure credentials.

### Authenticated actor

Mutation APIs do not trust `ownedByViewer`, client labels, or the `referenceActorContext` as authorization truth.

A deployment identity gateway may inject:

```text
x-rfxchange-user-id
x-rfxchange-organization-id
```

only when `RFXCHANGE_TRUST_IDENTITY_HEADERS=1`. The server then re-resolves that user/organization pair through `organization_memberships` and loads the role/permission set from PostgreSQL before permitting a mutation.

In production, missing identity integration fails closed.

### RFx commands

`POST /api/exchange/rfx/workflows` persists:

- create/draft;
- save/manage/update;
- publish;
- collaborator invitation;
- response draft/submission;
- responses list;
- close;
- award/advance lifecycle state.

The service uses `exchange_records`, `rfx_records`, `rfx_pursuits`, `rfx_responses`, collaboration requests, and activity events. When an RFx requires authoritative external submission, RFxchange requires an external submission reference before marking the response submitted rather than pretending to submit to an external buyer system.

### Resources and Intelligence commands

`POST /api/exchange/domain-workflows` persists:

Resources:
- offer;
- edit;
- request;
- archive.

Intelligence:
- add insight;
- edit insight;
- add note.

Resource creation deliberately does not invent map coordinates. Real geocoding/location resolution remains a separate geography service concern.

### Shared workflows

`POST /api/exchange/workflows` persists:

- Save;
- Watch;
- Track;
- Follow;
- Share execution provenance;
- referrals;
- teaming requests;
- connection requests;
- workflow/activity events.

Durable relationship state is hydrated back into Exchange result cards when an authenticated user context is available.

### Recipient referral policy

`GET /api/exchange/referrals/policy?recordId=...` resolves the organization attached to the selected Exchange record and returns only a published `referral_policies` record. Missing policy means “not configured,” not a generated fee.

## Database prerequisites

A server-capable deployment must configure `DATABASE_URL` and apply the canonical/additive schema files required by the enabled domains, including:

```text
db/schema.sql
db/rfx-domain.sql
db/resources-extension.sql
db/intelligence.sql
db/shared-workflows.sql
db/referral-policies.sql
```

`RFXCHANGE_DATABASE_POOL_MAX` may tune the application pool size.

## Static preview boundary

The GitHub Pages preview remains an inspection surface. `RFXCHANGE_PAGES_PREVIEW=1` exposes `NEXT_PUBLIC_RFXCHANGE_REFERENCE_MODE=1` during the export so the UI can show deterministic records and hierarchical navigation, but write workflows do not claim durable persistence.

This separation is deliberate:

```text
Static Pages preview -> inspect composition and hierarchy
Server deployment     -> PostgreSQL + authenticated services + durable workflows
```

## What remains intentionally unavailable

The following source-defined capabilities remain visible but unavailable because this repository does not currently contain the corresponding trustworthy production provider:

- AI → AMACS mapping/inference;
- AMACS-backed RFx/capability matching;
- production capability evidence/object-storage command handling;
- capability gap-analysis service;
- capability publication command service.

These are not replaced with invented behavior. They should be enabled through the existing action/workflow contracts when their real services are connected.
