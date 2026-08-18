# Organization Selection / Creation

## Purpose

`Identity & Onboarding Shell → Organization Selection / Creation` resolves the verified user to one canonical RFxchange organization identity before geography, profile, capability, and Exchange-ready steps begin.

The subsystem deliberately answers two questions and stops there:

1. Which organization should this user operate through?
2. Does that organization already exist in RFxchange, or must a canonical organization identity be created?

It must not become a second Organization Profile editor, capability editor, geography workflow, membership paywall, or authenticated Exchange surface.

## Chassis boundary

This module runs inside the Identity & Onboarding shell. It does not mount the persistent Exchange map, drawer, action rail, record cards, or RFx / Resources / Intelligence / Capabilities navigation.

The current reference route is:

```text
/onboarding/organization
```

Successful resolution hands off to the next onboarding boundary:

```text
/onboarding?step=geography
```

A dedicated Geography implementation can replace that handoff without changing organization-resolution contracts.

## User flows

```text
Verified account
      │
      ▼
Organization choice
      │
      ├─────────────── Find existing ───────────────┐
      │                                             │
      │                                     Organization search
      │                                             │
      │                           ┌─────────────────┴───────────────┐
      │                           │                                 │
      │                     Seeded/unclaimed                  Claimed/verified
      │                           │                                 │
      │                     Claim organization                 Request access
      │                           │                                 │
      └───────────────┬───────────┴─────────────────────────────────┘
                      │
                      ▼
               Organization resolved
                      │
                      ▼
                   Geography

Organization choice
      │
      └─────────────── Create new
                              │
                       Minimal identity
                              │
                       Duplicate check
                              │
                  ┌───────────┴───────────┐
                  │                       │
            Possible match           No match
                  │                       │
          Existing-org review       Confirm creation
                  │                       │
                  └───────────┬───────────┘
                              ▼
                      Organization resolved
```

## Canonical concepts

### Organization Account

Administrative tenant identity. Production persistence should own lifecycle, claims, authority state, restrictions, commercial linkage, and the active organization context.

### Organization Profile

Exchange-facing representation of the same canonical organization. This module initializes only the minimum identity required to continue; detailed profile enrichment belongs to the later Organization Profile stage.

### Organization Membership

The user-to-organization relationship. Creation may establish the creator as an active initial administrator subject to production policy. Existing claimed organizations should normally create a pending access request rather than silently grant authority.

### Claim / authority state

A seeded organization can be selected without creating another tenant. Claiming should preserve the canonical organization ID and move authority through domain validation, administrator approval, authoritative evidence, documentation, or manual review as production services require.

Organization authority and public `Verified` trust status are separate concepts.

## Duplicate/entity resolution

Before a new organization is committed, the production entity-resolution service should compare normalized identity signals including:

- legal/common organization name;
- aliases / DBA names;
- website and email domain;
- address and geography;
- phone;
- authoritative/government identifiers when available;
- existing claims and memberships.

Similar names alone must not force a destructive merge. Potential conflicts should preserve both records and history until resolved by governed entity-resolution logic.

## Reference implementation

The repository currently contains a deterministic reference organization set and a normalized API boundary:

```text
GET /api/onboarding/organizations?q=<query>&domain=<domain>
```

The UI uses that boundary for organization search and duplicate interruption. It never queries domain tables directly.

The reference completion path writes an `OrganizationResolution` object into session storage under:

```text
rfxchange.onboarding.organization
```

This is intentionally **not production persistence**. It proves the client flow and the handoff contract while keeping the backend truth boundary explicit.

## Production integration

Replace the reference search/persistence implementation behind the existing UI contract with application services that perform:

```text
Identity session
      │
      ▼
Organization Resolution Service
      │
      ├── Search / entity matching
      ├── Duplicate scoring
      ├── Invitation resolution
      ├── Claim / authority workflow
      └── Conflict resolution
      │
      ▼
Organization Account Service
      │
      ├── Canonical organization
      ├── Organization profile seed
      └── lifecycle state
      │
      ▼
Membership / Authorization Service
      │
      ├── user membership
      ├── role preset
      └── granular permissions
      │
      ▼
Audit / Event Service
```

Production completion must persist server-side:

- canonical `organization_id`;
- organization account/profile linkage;
- `organization_membership`;
- role and permissions;
- invitation or acquisition attribution;
- claim and authority state;
- duplicate/conflict decisions;
- audit events.

## Truth and security rules

- Never create a second organization merely because an existing seeded record is incomplete.
- Never grant administrative authority solely because a user selected an existing organization.
- Never treat a UI-disabled action as authorization enforcement; membership and authority decisions must be server-side.
- Never imply that reference/session state is canonical production truth.
- Do not require paid membership to establish a legitimate organization identity.
- Do not collect Geography, detailed Organization Profile, AMACS capability evidence, or verification data in this bounded step.

## Completion contract

Organization Selection / Creation is complete when the platform can provide the next onboarding step with:

```text
user_id
organization_id
organization_membership_id
organization_name
organization_type
claim / authority state
invitation / acquisition context (when present)
onboarding session / progress state
```

The current reference implementation proves the user-facing state machine and normalized organization-search boundary. Production identity, persistence, invitation validation, authorization, and audit services remain explicit downstream integrations.
