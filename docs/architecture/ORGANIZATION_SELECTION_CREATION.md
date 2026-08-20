# Organization Selection / Creation

## Purpose

`Identity & Onboarding Shell → Organization Selection / Creation` resolves a verified RFxchange user to one canonical organization and establishes the user-to-organization membership and authority context required before Geography, Organization Profile, Capability Enrichment, and Exchange-ready completion.

This module does not duplicate the downstream Geography, Organization Profile, or Capabilities workflows. It establishes organization identity, affiliation, authority, membership, conflict resolution, and durable onboarding state; later modules enrich the same canonical organization.

## Operating-chassis boundary

Organization Selection / Creation remains inside the Identity & Onboarding shell. It does not mount or recreate the authenticated Exchange map, results drawer, action rail, record cards, or lens navigation.

The addressable workflow root is:

```text
/onboarding/organization?step=<workflow-step>
```

Successful organization resolution hands off to the existing Geography route:

```text
/onboarding/geography?organizationId=<id>&organizationName=<name>
```

The existing downstream routes remain:

```text
/onboarding/organization-profile
/onboarding/capabilities
/onboarding/completion
```

## Source-derived hierarchical workflow tree

The implementation represents the Registration and Onboarding source flows as a real hierarchy rather than a transient form:

```text
Organization Selection / Creation
│
├── Welcome / role selection
│
├── Organization affiliation
│   │
│   ├── Find / join existing
│   │   ├── Search organizations
│   │   ├── Review organization
│   │   ├── Claim & authority
│   │   │   ├── Verified organization-domain email
│   │   │   ├── Authoritative public / registry evidence
│   │   │   ├── Supporting documentation
│   │   │   └── Manual administrative review
│   │   ├── Platform claim review
│   │   ├── Request access
│   │   ├── Existing-admin approval
│   │   └── Invitation validation & acceptance
│   │
│   └── Create new organization
│       ├── Organization identity
│       ├── Duplicate / conflict resolution
│       ├── Authority confirmation
│       └── Create & establish membership
│
└── Status & completion
    ├── Pending approval / review
    └── Organization connected
```

Each navigable child and grandchild has an explicit `OrganizationStep` and URL state. Prerequisite-dependent items remain unavailable until the required organization, invitation, access request, claim, or create-state context exists.

## Source coverage

### Onboarding source

The source-specific Referral / Invitation branch is implemented end-to-end:

```text
Invitation entry
  → validate invitation
  → verify invited email matches the verified account
  → display organization + assigned role
  → accept invitation
  → consume one-time invitation
  → create organization membership
  → confirm role / access
  → Geography
```

The source Welcome / Role Selection behavior is represented as governed role context:

- new organization creator → `Primary Administrator`;
- existing organization join → requested role + existing-admin approval;
- invitation → inviter-assigned role confirmed on acceptance.

The source Organization Setup fields are split according to the canonical platform IA:

- Organization Name and Organization Type → this module;
- Location / Geography → `/onboarding/geography`;
- Visibility Preferences → `/onboarding/organization-profile`.

### Registration source

The Registration source's `Claim existing organization / Create new organization` decision is implemented directly.

The source Organization Details fields remain on their existing downstream route instead of being duplicated here:

- description;
- Industry / NAICS;
- detailed contact information;
- public/profile visibility.

Website/domain is accepted here only as a minimum identity and duplicate-resolution signal, then seeded into the in-progress Organization Profile record.

## URL-addressable nested state

The workflow uses these concrete states:

```text
welcome
affiliation
existing.search
existing.review
existing.claim
existing.join
invitation.review
create.identity
create.duplicates
create.authority
create.confirm
status.pending
status.connected
access.review
claim.review
```

Organization ID, invitation token, access-request ID, and claim ID are carried as bounded route context only where required. Authoritative resolution state is persisted server-side in PostgreSQL; browser `sessionStorage` is not the source of truth.

## Verified onboarding session

Organization APIs require the signed, HTTP-only onboarding session established only after account email verification.

The session contains bounded verified onboarding identity context and is HMAC-protected using `ONBOARDING_SESSION_SECRET`, with the account-verification secret available as the configured fallback. It is `HttpOnly`, `SameSite=Lax`, application scoped, time bounded, and secure in production.

Organization search, claim, create, invitation acceptance, access review, and claim review reject requests without a valid verified onboarding session.

## Real persistence and services

The earlier Organization Selection implementation used deterministic organization seed data, `createReferenceResolution`, `referenceOnly` responses, and browser session storage. Those mechanisms are not used by this subsystem now.

Production execution targets PostgreSQL/PostGIS through `DATABASE_URL` and the `postgres` client. When the database is unavailable or unconfigured, the API returns an explicit service/configuration error rather than silently switching to fake organization records.

Apply the schema in dependency order:

```text
db/schema.sql
db/identity-verification.sql
db/organization-profile.sql
db/organization-selection.sql
```

The Organization Selection migration adds or extends:

```text
organization_identity
organization_aliases
organization_invitations
organization_join_requests
organization_claims
organization_claim_evidence
organization_onboarding_state
platform_user_roles
organization_memberships.status
organization_memberships.is_primary
```

## Organization search and entity resolution

`GET /api/onboarding/organizations` searches the canonical organization repository.

Entity resolution uses real persisted signals supported by the current schema:

- canonical organization name;
- aliases / DBA names;
- website / primary domain;
- stored organization location for result context;
- PostgreSQL trigram similarity;
- exact domain matching.

The create transaction repeats a high-confidence duplicate check immediately before insert. The client cannot bypass duplicate resolution merely by navigating around a UI step.

## Existing organization: claim and authority

An unclaimed organization retains its canonical `organization_id`; claiming does not create a second organization.

Four source-supported authority paths are implemented.

### Verified organization-domain email

When the verified account email domain matches the organization's stored primary domain, RFxchange can approve the claim immediately. The organization becomes claimed, the user receives the Primary Administrator membership, onboarding state becomes connected, and the action is audited.

### Authoritative public / registry evidence

The claimant can submit an authoritative registry or filing reference and/or an HTTPS record URL. The evidence is persisted against the claim and enters platform review.

### Supporting documentation

The claimant can submit an HTTPS reference to supporting authority documentation. The evidence record is attached to the claim for the platform reviewer. The document bytes themselves belong in approved object storage; this module stores the governed reference and metadata rather than inventing browser-local file persistence.

### Manual administrative review

When the other evidence methods are unavailable, the claimant submits an authority statement. It is persisted as claim evidence and enters the same platform-review workflow.

## Competing claims and platform review

Manual, registry, and supporting-document claims can become competing claims.

A second active claimant moves the organization's active pending claims into `conflict` state rather than overwriting the earlier claimant. A platform user explicitly provisioned with `platform_admin` authority can open the claim-review deep link and compare active claimants and their evidence.

Approving a claim transactionally:

- approves the selected claim;
- denies the other active competing claims for the organization;
- preserves claim/evidence history;
- marks the canonical organization claimed;
- creates or updates the winning Primary Administrator membership;
- updates the winner's durable onboarding state to connected;
- clears losing claimants' organization-resolution state;
- records the platform activity event.

The reviewer cannot approve a claim as the claimant's primary organization when the claimant already has a different active primary organization.

## Existing organization: join and admin approval

Claimed or verified organizations never grant authority because a user selected them in the client.

The user chooses a requested role and RFxchange creates a durable `organization_join_request`.

An active member of that organization with Primary Administrator role or `organization.members.manage` permission can open the access-review deep link and approve or deny the request.

Approval creates or updates the real organization membership and records `admin-approved` authority state. Denial clears that pending organization resolution so the requester can choose another affiliation.

A partial unique index permits only one active pending access request per requester/organization while still preserving historical approved, denied, or cancelled attempts.

## Invitation path

Invitation tokens are stored only as SHA-256 hashes. The raw invitation token remains transient in the invitation URL and is not persisted in organization tables.

Acceptance requires:

- pending invitation;
- non-expired invitation;
- exact match between the invitation email and verified onboarding account;
- one-primary-organization rule;
- successful transactional membership creation.

Acceptance consumes the invitation once, creates the assigned organization membership, persists onboarding state, and writes an activity event.

## Create-new path

The create workflow is intentionally decomposed:

```text
Organization identity
  → duplicate / entity resolution
  → authority representation
  → confirmation
  → server-side duplicate recheck
  → canonical organization transaction
```

The transaction creates:

- the canonical `organizations` tenant identity;
- minimum `organization_identity` data;
- an in-progress `organization_profiles` row;
- the creator's Primary Administrator organization membership;
- durable `organization_onboarding_state`;
- an `OrganizationCreated` activity event.

Detailed organization content is completed downstream rather than duplicated here.

## One-primary-organization rule

The source establishes one primary organization during initial onboarding, with additional organizations handled later.

This invariant is enforced through both:

- server-side workflow checks before organization creation, claim approval, and invitation acceptance;
- a partial unique PostgreSQL index covering active primary organization memberships.

The client cannot override the rule.

## Claim and request history

Organization claim and access-request history is preserved. Partial unique indexes constrain only active states:

```text
one pending join request per organization + requester
one pending/conflict claim per organization + claimant
```

Resolved rows remain available for audit rather than creating uniqueness failures when a legitimate later request or claim is submitted.

## Activity and audit integration

Meaningful transitions write shared platform activity events, including:

```text
OrganizationCreated
OrganizationInvitationAccepted
OrganizationAccessRequested
OrganizationAccessApproved
OrganizationAccessDenied
OrganizationClaimSubmitted
OrganizationClaimApproved
OrganizationClaimApprovedByAdmin
OrganizationClaimDeniedByAdmin
```

These events plug into the chassis audit, notification, analytics, and future intelligence infrastructure rather than creating an Organization-only event subsystem.

## Static preview versus production service

GitHub Pages remains a static UI projection. The production application uses authenticated server routes and PostgreSQL; the Pages build intentionally does not fabricate API responses or fake organization data merely to make buttons appear functional.

The organization route parses query-string navigation on the client so the nested hierarchy can still be rendered by the static projection. Real search, claim, create, invitation, and approval operations require a server-capable deployment with `DATABASE_URL` configured.

## Truth and security rules

- Never create a second organization merely because an existing record is incomplete.
- Never grant claimed-organization authority solely from a client selection.
- Never store raw invitation tokens.
- Never treat disabled or hidden UI as authorization; approval is enforced server-side.
- Never treat organization-administration authority as public RFxchange `Verified` status.
- Never use browser session storage as canonical organization truth.
- Never fall back to deterministic fake organizations when the database is unavailable.
- Never overwrite competing claims; preserve them for authorized resolution.
- Persist claim evidence references and metadata; put document bytes in approved object storage.
- Do not place a payment gate before legitimate organization identity is established.
- Do not duplicate Geography, detailed Organization Profile, visibility, or AMACS capability enrichment in this bounded module.

## Completion contract

Organization Selection / Creation is complete only when RFxchange has real server-side values for:

```text
verified user identity
canonical organization_id
organization membership
role / permissions
resolution mode
claim / authority state
invitation / acquisition context when applicable
durable onboarding progress
audit event(s)
```

The immediate handoff is the existing Geography route, continuing enrichment against the same canonical organization.
