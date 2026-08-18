# Organization Selection / Creation

## Purpose

`Identity & Onboarding Shell → Organization Selection / Creation` resolves a verified RFxchange user to one canonical organization and establishes the user-to-organization membership/authority context required before Geography, Organization Profile, Capability Enrichment, and Exchange-ready completion.

This module does **not** duplicate the downstream Geography or Organization Profile forms. It establishes organization identity, affiliation, authority, membership, and resolution state; downstream modules enrich the same canonical organization.

## Chassis boundary

This workflow remains inside the Identity & Onboarding shell. It does not mount or recreate the authenticated Exchange map, sliding drawer, action rail, cards, or lens navigation.

The addressable workflow root is:

```text
/onboarding/organization?step=<workflow-step>
```

Successful organization resolution hands off to the existing Geography implementation:

```text
/onboarding/geography?organizationId=<id>&organizationName=<name>
```

The subsequent existing routes remain:

```text
/onboarding/organization-profile
/onboarding/capabilities
/onboarding/completion
```

## Source-derived hierarchical workflow tree

The implementation represents the source Registration and Onboarding flows as a real hierarchy rather than one transient form:

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

Each navigable child/grandchild is represented by an explicit `OrganizationStep` and URL state. Prerequisite-dependent items remain disabled in the hierarchy until their required organization, invitation, request, claim, or create-state context exists.

## Source coverage

### Onboarding source

The source-specific **Referral / Invitation** branch is implemented end-to-end:

```text
Invitation entry
  → validate invitation
  → verify invited email matches the verified account
  → display organization + assigned role
  → accept invitation
  → consume one-time invitation
  → create organization membership
  → confirm role/access
  → Geography
```

The source **Welcome / Role Selection** behavior is represented as governed role context:

- new organization creator → `Primary Administrator`;
- existing organization join → requested role + existing-admin approval;
- invitation → inviter-assigned role confirmed on acceptance.

The source Organization Setup fields are split according to the canonical platform IA:

- Organization Name and Organization Type → this module;
- Location / Geography → `/onboarding/geography`;
- Visibility Preferences → `/onboarding/organization-profile`.

### Registration source

The Registration source's `Claim existing organization / Create new organization` decision is implemented directly.

The source Organization Details fields remain on their existing concrete downstream route rather than being duplicated here:

- Description;
- Industry / NAICS;
- Website/contact enrichment;
- visibility/public presentation.

The website/domain field is accepted here only as a minimum entity-resolution signal and is carried into the in-progress organization profile seed.

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

Organization ID, invitation token, access-request ID, and claim ID are carried as bounded route context where required. Durable authoritative resolution state is server-side in PostgreSQL; browser `sessionStorage` is not used as the source of truth.

## Verified onboarding session

Organization mutation endpoints require the signed, HTTP-only onboarding session created after account email verification.

The cookie contains bounded verified onboarding identity context and is HMAC-protected using `ONBOARDING_SESSION_SECRET` (falling back to the already-required account-verification secret when appropriate). It is `HttpOnly`, `SameSite=Lax`, scoped to the application, and secure in production.

Organization search, claim, create, invitation acceptance, and approval APIs return `401 verification_required` when that verified onboarding session is absent or invalid.

## Real persistence and services

The previous deterministic `organizationSeed`, `createReferenceResolution`, `referenceOnly` API response, and browser `rfxchange.onboarding.organization` session-storage record have been removed from this subsystem.

Production execution now targets the canonical PostgreSQL/PostGIS architecture through `DATABASE_URL` and the `postgres` client. If the database is not configured, the service returns an explicit configuration error rather than silently falling back to mock organizations.

Apply:

```text
db/schema.sql
db/identity-verification.sql
db/organization-profile.sql
db/organization-selection.sql
```

The organization-selection migration adds:

```text
organization_identity
organization_aliases
organization_invitations
organization_join_requests
organization_claims
organization_onboarding_state
platform_user_roles
organization_memberships.status
organization_memberships.is_primary
```

## Organization search / entity resolution

`GET /api/onboarding/organizations` now searches the canonical organization repository.

Entity resolution uses real stored signals supported by the current schema:

- canonical organization name;
- aliases / DBA names;
- website/primary domain;
- first stored organization location for result context;
- PostgreSQL trigram similarity;
- exact domain matching.

The create transaction repeats a high-confidence duplicate check immediately before insert. The client therefore cannot bypass duplicate resolution by skipping UI steps.

## Existing organization: claim

Unclaimed organizations preserve their canonical `organization_id`.

Authority paths are:

### Verified organization-domain email

When the verified account email domain matches the organization's stored primary domain, the claim is approved server-side, the canonical organization becomes claimed, and the user receives the Primary Administrator membership.

### Administrative review

When domain authority is unavailable, RFxchange creates a durable claim with an authority/evidence note. Pending/competing claims remain separate records. A user provisioned with the `platform_admin` platform role can open the claim-review deep link, compare active claims, and approve or deny the selected claim.

Approving one claim:

- marks the selected claim approved;
- denies the other active competing claims for the organization;
- preserves all claim history;
- marks the organization claimed;
- creates/updates the winning Primary Administrator membership;
- updates the claimant's onboarding state;
- clears losing claimant organization-resolution state;
- writes an activity event.

This avoids destructive organization merges.

## Existing organization: join

Claimed/verified organizations never grant authority simply because a user selected them.

The user chooses a requested role and RFxchange persists an `organization_join_request`.

An existing organization member with `Primary Administrator` role or `organization.members.manage` permission can open the access-review deep link and approve or deny the request.

Approval creates/updates the real organization membership and records `admin-approved` authority state. Denial clears the requester's organization resolution so another affiliation can be chosen.

## Invitation path

Invitation tokens are stored only as SHA-256 hashes. The raw token remains in the invitation URL and is never persisted by the organization-selection tables.

Acceptance requires:

- pending invitation;
- non-expired invitation;
- exact match between invitation email and verified onboarding account;
- one-primary-organization rule;
- successful transactional membership creation.

The invitation is consumed once and acceptance is audited.

## Create-new path

The create workflow is intentionally decomposed:

```text
Organization identity
  → duplicate/entity resolution
  → authority representation
  → confirmation
  → server-side duplicate recheck
  → canonical organization transaction
```

The transaction creates:

- `organizations` canonical tenant identity;
- `organization_identity` minimum organization identity;
- an in-progress `organization_profiles` row;
- the creator's Primary Administrator `organization_membership`;
- durable `organization_onboarding_state`;
- an `OrganizationCreated` activity event.

Detailed profile data is still completed downstream.

## One-primary-organization rule

The Registration source says one primary organization per account during initial onboarding, with additional organizations later.

This is enforced in two places:

- server-side workflow checks before organization creation, claim, or invitation acceptance;
- a partial unique PostgreSQL index on active primary organization memberships.

The client cannot override this invariant.

## Audit and activity

Meaningful transitions write platform activity events, including:

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

These events remain available to the shared audit/notification/analytics infrastructure.

## Truth and security rules

- Never create a second organization because an existing record is incomplete.
- Never grant claimed-organization authority solely from a client selection.
- Never store raw invitation tokens.
- Never treat disabled UI as authorization; all approvals are enforced server-side.
- Never treat administrative authority as public RFxchange `Verified` status.
- Never use browser session storage as canonical organization truth.
- Never fall back to deterministic fake organizations when `DATABASE_URL` is absent.
- Do not place a payment gate before legitimate organization identity is established.
- Do not duplicate Geography, detailed Organization Profile, visibility, or AMACS capability enrichment in this bounded module.

## Completion contract

Organization Selection / Creation is complete when RFxchange has real server-side values for:

```text
verified user identity
organization_id
organization membership
role / permissions
resolution mode
claim / authority state
invitation / acquisition context when applicable
durable onboarding progress
audit event(s)
```

The immediate handoff is the existing Geography route, continuing enrichment against the same canonical organization.
