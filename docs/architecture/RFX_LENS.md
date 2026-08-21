# RFx lens

## Purpose

`Authenticated Exchange Shell → Bottom navigation → RFx` is the demand-and-transaction lens of the RFxchange operating chassis. It remains inside the persistent Exchange map, universal search, floating controls, three-state results drawer, four-slot **lens-control rail**, shared cards, shared detail controller, bottom navigation, and cross-lens utilities.

The RFx lens owns a real hierarchical transaction workspace rather than disabled action placeholders. The transaction hierarchy remains implemented in `lib/rfx/workflow-tree.ts` and the RFx workspace service.

## Chassis boundary

The chassis owns composition and interaction mechanics. RFx supplies:

- RFx records and domain detail;
- RFx search terms and map projection;
- issuer/responder workflow trees;
- workflow state and persistence;
- pursuit and RFx lifecycle state;
- role-aware lens commands;
- record-specific actions;
- RFx-specific handoffs into Capabilities, Resources, Referrals, external submission, and the shared detail surface.

RFx records without useful coordinates remain valid drawer results and do not require map markers.

## Lens controls versus record actions

RFx now follows the platform-wide separation of concerns:

```text
RFx lens rail       → commands about the RFx workspace as a whole
RFx card buttons    → commands about one RFx record
RFx card star       → Watch / unwatch that record
RFx card body       → open that record's detail
metadata chips      → information only
```

Selecting a map marker or card does **not** replace the four lens controls. There is no implicit `records[0]` selection.

## Four RFx lens-control positions

For an authenticated viewer whose active organization can issue RFx:

1. **Create RFx** — creates a new owned draft and enters the issuer creation hierarchy. It never requires selection of the organization's own marker or another record.
2. **My RFx** — scopes the drawer to organization-owned RFx records.
3. **Watched** — scopes the drawer to watched/saved RFx records.
4. **All** — restores the full RFx result set.

For a viewer whose active organization cannot issue RFx, issuer commands are not shown merely because the RFx lens is active. The rail resolves to:

1. **Watched**
2. **Mapped**
3. **Off-map**
4. **All**

This keeps all four positions useful without presenting an inapplicable Create RFx command.

Production issuer eligibility and user authority must come from authenticated active-organization policy. The TestRFx reference shell currently derives conservative capability defaults from owned fixture records and exposes `ExchangeViewerContext` as the replacement seam.

## RFx card actions

Record actions are returned by the RFx record-action resolver and rendered directly on cards.

### Another organization's RFx

- **Respond** — shown when the viewer may respond; opens the responder transaction hierarchy.
- **Team** — opens the source-defined teaming hierarchy.
- **Share** — shares/copies the canonical RFx deep link.

### Organization-owned RFx

- **Manage** — opens the issuer lifecycle hierarchy for that RFx.
- **Invite Team** — opens the issuer collaborator hierarchy.
- **Share** — shares/copies the canonical RFx deep link.

**View Detail** is intentionally not a button in either action set: tapping the card body opens detail for an unambiguous target.

**Watch** is intentionally not duplicated in the action row: the card star owns the lightweight watch toggle and persists through the RFx workspace service.

## Source-derived issuer hierarchy

The issuer workflow remains rooted at these real branches:

```text
Issuer RFx
├── Create RFx / Opportunity
│   ├── Define Need
│   │   ├── What do you need?
│   │   ├── Starting Point
│   │   └── Select RFx Type
│   ├── Build Scope
│   │   ├── Scope
│   │   ├── Deliverables
│   │   ├── Requirements
│   │   ├── Schedule
│   │   ├── Commercial Terms
│   │   └── Define Who Is Needed
│   ├── Understand Market
│   ├── Establish Evaluation
│   ├── Assemble RFx Package
│   ├── Review / Approve
│   ├── Pre-Publication Validation
│   ├── Preview
│   └── Publish
├── Manage RFx
│   ├── Overview / Status
│   ├── Draft / Save / Publish
│   ├── Q&A / Addenda
│   ├── View Responses / Matches
│   ├── Evaluate
│   ├── Decision / Next Step
│   └── Post-RFx Outcome
├── Invite Team / Collaborators
└── Track / Watch Status
```

The complete child/grandchild definitions remain canonical in `lib/rfx/workflow-tree.ts`; the action-placement change does not alter that transaction hierarchy.

## Source-derived responder hierarchy

```text
Responder RFx
├── View RFx Detail
│   ├── What is this?
│   ├── Why am I seeing it?
│   ├── Can I pursue it?
│   └── What will pursuing require?
├── Respond / Submit
│   ├── Assess Fit
│   ├── Go / No-Go
│   ├── Resolve Gaps
│   ├── Build Team
│   ├── Plan Response
│   ├── Draft
│   ├── Collaborate
│   ├── Q&A / Addenda
│   ├── Validate Compliance
│   ├── Review
│   ├── Submit
│   ├── Clarify
│   ├── Decision
│   ├── Execute
│   └── Report Outcome
├── Team / Join / Collaborate
├── Watch / Follow
├── Refer Relevant Organization
└── Outcome
```

Again, the complete nested definitions live in `lib/rfx/workflow-tree.ts` and continue to render as true navigation state rather than inert headings.

## Sticky RFx workflow context actions

The source separately defines contextual `View / Match / Refer / Save` behavior inside the RFx transaction surface. Those workflow-context commands do not consume the permanent lens rail or the card action row.

- **View** returns to the shared RFx detail controller.
- **Match** shows structured match context with an explicit non-qualification boundary.
- **Refer** creates an RFx-context referral record and can hand off to Menu → Referrals Management.
- **Save** uses the durable Watch/Track persistence also used by the card star.

## Nested navigation state

The active RFx workflow is a recursive `RfxWorkflowNode` tree. The workspace records issuer/responder perspective, current entry workflow, active nested path, values, completed node IDs, list items, responder pursuit state, issuer RFx lifecycle state, version, and timestamps.

The UI renders breadcrumbs and child cards from the same tree, so child and grandchild items are true navigation states.

## Real workspace service

RFx workflow persistence uses `lib/rfx/workspace-client.ts`:

1. `/api/rfx/workspaces` is used when the shared Postgres environment is configured and trusted.
2. The API persists JSONB workspace state plus append-only workspace events.
3. Static preview/offline/unconfigured environments fall back to explicit local-device persistence rather than pretending a remote mutation succeeded.
4. The UI reports the active persistence mode.

`db/rfx-workspaces.sql` contains the corresponding schema. Credentials must never be hard-coded.

## Watch / Track

The RFx card star uses the RFx workspace service. The responder workspace also updates pursuit state between `discovered` and `watching`. The lens-level **Watched** control merely scopes results to records whose watch relationship is active; it does not duplicate the toggle.

## RFx and pursuit state

RFx lifecycle and organization pursuit state remain separate because many organizations can have different relationships with the same RFx.

Issuer lifecycle includes draft, internal review/readiness, open, close, evaluation, clarification, selection/award, execution, completion, and cancellation states supported by the source cycle.

Responder pursuit includes discovered, matched, invited, watching, assessing, declined, pursuing, teaming, drafting, ready, submitted, withdrawn, clarification, selected/not-selected, executing, and outcome-reported states.

## Truth boundaries

- A discovery match, potential match, or invitation is not qualification, endorsement, eligibility, or award prediction.
- RFxchange organizes evaluation; it does not choose the winner.
- Teaming invitations do not create a legal teaming agreement. The workflow preserves `Discover → Discuss → Invite → Agree externally → Participate in response`.
- Externally sourced RFx records use an external-submission handoff. RFxchange does not claim formal submission or legal award authority where the issuer's external system is authoritative.
- Local-device persistence does not claim cross-user delivery.

## Discovery fixtures versus services

The RFx catalog and Exchange seed records remain sample discovery content for TestRFx. They are not the workflow persistence service. Replacing sample discovery content with imported/live RFx feeds is a separate data-ingestion integration.

## Remaining production integrations

The remaining dependencies must preserve the action-scope separation introduced here:

- authenticated viewer and active-organization resolution;
- server-side organization eligibility, role, and permission policy for Create/Respond/etc.;
- deployment configuration for shared Postgres workspaces;
- transactional invitation/notification delivery;
- object storage for solicitation and response attachments;
- live RFx/import connectors;
- formal external-submission integrations where issuer systems permit them.

None of those integrations should move record actions back into the lens rail or make Create RFx depend on record selection.
