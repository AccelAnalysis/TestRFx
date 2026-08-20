# RFx lens

## Purpose

`Authenticated Exchange Shell → Bottom navigation → RFx` is the demand-and-transaction lens of the RFxchange operating chassis. It remains inside the persistent Exchange map, universal search, floating controls, three-state results drawer, four-slot action rail, shared cards, shared detail controller, bottom navigation, and cross-lens utilities.

The RFx lens now owns a real hierarchical transaction workspace rather than a set of disabled action placeholders. The workflow tree is derived from the RFx source flow and transaction-cycle source; it does not add product branches that are not represented there.

## Chassis boundary

The chassis continues to own composition and interaction mechanics. RFx supplies:

- RFx records and domain detail;
- RFx search terms and map projection;
- own-organization vs. other-organization actions;
- the issuer and responder workflow trees;
- workflow state and persistence;
- pursuit and RFx lifecycle state;
- RFx-specific handoffs into Capabilities, Resources, Referrals, external submission, and the shared detail surface.

RFx records without useful coordinates remain valid drawer results and do not require map markers.

## Four governed action positions

For another organization's RFx:

1. **View Detail** → opens the responder understanding hierarchy.
2. **Respond** → opens the complete responder transaction hierarchy.
3. **Team** → opens the source-defined `Discover → Discuss → Invite → Agree externally → Participate in response` hierarchy.
4. **Watch** → persists the watch relationship in the RFx workspace service.

For an organization-owned RFx:

1. **Create RFx** → creates a new owned draft and opens the issuer creation hierarchy.
2. **Manage RFx** → opens the issuer lifecycle hierarchy.
3. **Invite Team** → opens the issuer collaborator hierarchy.
4. **Track** → persists the RFx tracking relationship in the same workspace service.

The action rail still owns exactly four physical positions. RFx business logic lives behind them.

## Source-derived issuer hierarchy

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
│   │   ├── Potential Matches
│   │   ├── Required Criteria Coverage
│   │   ├── Service Geography
│   │   └── Profile Completeness
│   ├── Establish Evaluation
│   │   ├── Evaluation Criteria
│   │   └── Evaluation Governance
│   ├── Assemble RFx Package
│   │   ├── Overview
│   │   ├── Scope
│   │   ├── Requirements
│   │   ├── Deliverables
│   │   ├── Schedule
│   │   ├── Commercial Information
│   │   ├── Evaluation
│   │   ├── Attachments
│   │   ├── Terms
│   │   └── Response Instructions
│   ├── Review / Approve
│   │   ├── Collaborators
│   │   ├── Requested Revisions
│   │   ├── Approval Gates
│   │   └── Publication Readiness
│   ├── Pre-Publication Validation
│   ├── Preview
│   └── Publish
├── Manage RFx
│   ├── Overview / Status
│   ├── Draft / Save / Publish
│   ├── Q&A / Addenda
│   │   ├── Questions
│   │   ├── Answers
│   │   ├── Addenda
│   │   └── Acknowledgements
│   ├── View Responses / Matches
│   │   ├── Potential Matches
│   │   ├── Invited Organizations
│   │   └── Received Responses
│   ├── Evaluate
│   │   ├── Compliance
│   │   ├── Individual Evaluation
│   │   ├── Clarification
│   │   ├── Consensus
│   │   ├── Recommendation
│   │   └── Approval
│   ├── Decision / Next Step
│   │   ├── Update
│   │   ├── Close
│   │   ├── Select / Award / Connection
│   │   ├── Advance
│   │   └── Refer from Context
│   └── Post-RFx Outcome
│       ├── Contract / Relationship Initiated
│       ├── Work Underway
│       ├── Completed
│       └── Outcome Reported
├── Invite Team / Collaborators
│   ├── Internal Collaborators
│   ├── Create Invitation
│   └── Responsibilities
└── Track / Watch Status
```

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
│   │   ├── Fit
│   │   ├── Eligibility
│   │   ├── Capacity
│   │   ├── Economics
│   │   ├── Competition
│   │   └── Gaps
│   ├── Go / No-Go
│   ├── Resolve Gaps
│   │   ├── Find a Teammate → Capabilities
│   │   └── Find a Resource → Resources
│   ├── Build Team
│   │   ├── Discover
│   │   ├── Discuss
│   │   ├── Invite
│   │   ├── Agree Externally
│   │   └── Participate in Response
│   ├── Plan Response
│   ├── Draft
│   ├── Collaborate
│   ├── Q&A / Addenda
│   │   ├── Submit Question
│   │   ├── View Answers
│   │   └── Acknowledge Addenda
│   ├── Validate Compliance
│   ├── Review
│   ├── Submit
│   │   ├── RFxchange-Hosted Submission
│   │   └── External Submission
│   ├── Clarify
│   ├── Decision
│   ├── Execute
│   └── Report Outcome
├── Team / Join / Collaborate
│   └── same five-stage teaming sequence
├── Watch / Follow
├── Refer Relevant Organization
└── Outcome
    ├── Saved
    ├── Submitted
    ├── Teamed
    └── Referred
```

## Sticky RFx context actions

The source separately defines `View / Match / Refer / Save`. Those are implemented inside the RFx workflow surface as contextual actions and do not replace the four governed shell action positions.

- **View** returns to the shared RFx detail controller.
- **Match** shows structured match context with an explicit non-qualification boundary.
- **Refer** creates an RFx-context referral record in the workspace and can hand off to Menu → Referrals Management.
- **Save** uses the same durable Watch/Track persistence used by the card star and action rail.

## Nested navigation state

The active RFx workflow is a recursive `RfxWorkflowNode` tree. The workspace records:

- issuer vs. responder perspective;
- current entry workflow;
- active nested path;
- values by workflow field;
- completed node IDs;
- list items such as requirements, deliverables, collaborators, questions, addenda, assignments, evaluations, clarifications, and referrals;
- responder pursuit state;
- issuer RFx lifecycle state;
- version and timestamps.

The UI renders breadcrumbs and child cards from the same tree, so child and grandchild items are true navigation states rather than headings with no destination.

## Real workspace service

RFx no longer uses mounted React state as its workflow persistence service.

`lib/rfx/workspace-client.ts` uses the following service policy:

1. Use `/api/rfx/workspaces` when the server has a configured Postgres `DATABASE_URL`.
2. The API uses `@neondatabase/serverless` over HTTP and persists JSONB workspace state plus an append-only workspace event record.
3. If the app is running as the static GitHub Pages preview, offline, or without a configured database, the same complete workflow persists to `localStorage` as an explicit **Local device workspace**. This is a functioning local persistence mode, not a fake remote success response.
4. The UI displays which persistence mode is active.

`db/rfx-workspaces.sql` contains the matching schema, and the server repository can also create the two workspace tables defensively with `IF NOT EXISTS`.

Postgres shared persistence requires `DATABASE_URL`. The current repository does not contain database credentials and must never hard-code them.

## Watch / Track

Watch/Track and the RFx card star now use the RFx workspace service. The responder workspace also updates its pursuit state between `discovered` and `watching`. This replaces the previous mounted-only RFx watch toggle.

## RFx and pursuit state

The workspace keeps RFx lifecycle and organization pursuit state separate because many organizations can have different relationships with the same RFx.

Issuer lifecycle includes draft, internal review/readiness, open, close, evaluation, clarification, selection/award, execution, completion, and cancellation states supported by the source cycle.

Responder pursuit includes discovered, matched, invited, watching, assessing, declined, pursuing, teaming, drafting, ready, submitted, withdrawn, clarification, selected/not-selected, executing, and outcome-reported states.

## Truth boundaries

- A discovery match, potential match, or invitation is not qualification, endorsement, eligibility, or award prediction.
- RFxchange organizes evaluation; it does not choose the winner.
- Teaming invitations do not create a legal teaming agreement. The workflow explicitly preserves `Discover → Discuss → Invite → Agree externally → Participate in response`.
- Externally sourced RFx records use an external-submission handoff. RFxchange does not claim formal submission or legal award authority where the issuer's external system is authoritative.
- The local-device persistence mode does not claim cross-user delivery. Collaboration invitations can be shared using the device share/copy capability; multi-user notification/delivery requires the authenticated shared service environment.

## Discovery fixtures versus services

The existing RFx catalog and Exchange seed records remain sample discovery content for TestRFx. They are not used as the workflow persistence service and no action reports a fake backend mutation against those fixtures. New RFx work is stored in the real workspace adapter described above.

Replacing the sample discovery catalog with imported/live RFx feeds is a separate data-ingestion integration and should not be conflated with making the RFx transaction workflow operational.

## Connected functions

The source also identifies Organization Profile, Settings, Referrals Management, and the Cross-lens Referral Workflow. Those are shared/Menu responsibilities already represented outside the RFx lens, so this RFx hierarchy links or hands off to them rather than duplicating them as RFx sub-applications.

## Remaining production integrations

These are infrastructure dependencies, not mocked RFx buttons:

- authenticated viewer and active-organization resolution for server-side ownership/authorization;
- deployment configuration of the Postgres `DATABASE_URL` for shared multi-device workspaces;
- transactional email/push/in-app delivery for collaborator invitations and notifications;
- object storage for solicitation and response attachments;
- live RFx/import connectors to replace sample discovery fixtures;
- formal external-submission integrations where issuer systems permit them.

Those dependencies must preserve the existing RFx workflow and chassis contracts rather than reintroducing placeholder UI behavior.
