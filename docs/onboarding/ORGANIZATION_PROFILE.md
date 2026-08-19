# Identity & Onboarding — Organization Profile

## Review outcome

The first Organization Profile build established a useful bounded form, but the follow-up review against the source diagrams found five architectural problems:

1. The profile was flat rather than a true child/grandchild navigation tree.
2. `POST /api/onboarding/organization-profile` manufactured an organization ID and returned a `reference` adapter response without durable persistence or organization authorization.
3. The profile duplicated Geography-owned address/service-area fields and rendered a map placeholder even though Geography is the preceding canonical workflow.
4. The profile required a capability seed even though the source places capability entry, AMACS assistance, evidence, and certifications in Capability Enrichment.
5. The source-defined Organization Type from organization setup was not represented as a durable profile fact.

This revision removes those shortcuts and restores Organization Type using the existing source-supported organization-type vocabulary.

## Chassis placement

```text
Identity & Onboarding Shell
  Account verification
  -> Organization selection / creation
  -> Geography
  -> Organization Profile
  -> Capability Enrichment
  -> Exchange-ready completion
```

Organization Profile remains an Identity & Onboarding surface. It does not mount the authenticated Exchange map/drawer/lens chassis.

## Source-derived hierarchy

The Organization Profile hierarchy now preserves the children shown in the source Menu flow rather than flattening them into one form:

```text
Organization Profile
├── Organization Details
│   ├── Basic Information
│   ├── Contact & Address
│   ├── Industry & Codes
│   ├── Certifications
│   ├── Description
│   └── Logo & Branding
├── Verified Information
├── Capabilities (AMACS)
├── Locations
├── Team Members
│   ├── Team List
│   ├── Roles & Permissions
│   ├── Invitations
│   └── Access Management
├── Documents & Evidence
└── Brand & Visibility Settings
```

`Save Changes` remains an action in Organization Details rather than being turned into a fake navigation node.

Every node has an addressable route under `/onboarding/organization-profile/...`, breadcrumbs, parent/child state, and browser history. Nodes owned by another canonical onboarding domain hand off to that workflow instead of cloning it:

- Certifications -> Capability Enrichment
- Capabilities (AMACS) -> Capability Enrichment
- Locations -> Geography
- Documents & Evidence -> Capability Enrichment evidence workflow

## Canonical ownership boundaries

### Organization Profile owns

- organization display/legal identity
- source-defined Organization Type
- website and primary domain
- industry and codes
- organization description
- primary organizational contact
- participation roles and first-value goals
- brand name/logo URL
- profile projection visibility
- organization team membership management
- organization invitation records
- read projection of organization verification assertions

Organization Type is a single setup/profile classification. Participation roles remain multi-select because an organization can participate in the Exchange in more than one way.

### Geography owns

- physical/base address
- normalized address
- confirmed map point
- exact/approximate/locality-only location privacy
- primary locality/geography
- service geographies/service areas

Organization Profile reads those facts and links to Geography for edits. There is no Organization Profile map placeholder and no second address store.

### Capability Enrichment owns

- capability claims
- AI -> AMACS assistance
- evidence/certifications
- supporting capability documents
- tags/keywords/specialties
- capability publication intent

The legacy `organization_profiles.capability_seed` column is retained only for migration compatibility and is no longer required or written by this module.

## Real runtime services

The profile API is now a PostgreSQL-backed runtime service using `DATABASE_URL`. It does not return fake success when persistence is unavailable.

### Session / organization authorization

The service requires a signed `rfx_session` cookie. The cookie payload contains the authenticated user ID, active organization ID, and expiration, and is HMAC-protected by `RFXCHANGE_SESSION_SECRET`.

The API then resolves the user against `organization_memberships` before reading or mutating organization data. Editing profile or team data requires an owner/admin role or the applicable explicit permission.

There is deliberately no development identity fallback in this module. Until the production Identity provider issues the signed session after verified authentication, runtime profile writes fail closed.

### API

```text
GET /api/onboarding/organization-profile?organization=<uuid>
  -> canonical profile + primary Geography projection
     + team + invitations + verification assertions

PUT /api/onboarding/organization-profile
  mode=draft|complete
  -> validate + authorize + transactionally persist
     organization, organization_profiles, primary contact,
     and activity event

POST /api/onboarding/organization-profile
  create_invitation
  revoke_invitation
  update_member
  remove_member
```

The invitation service generates a cryptographically random token, stores only its SHA-256 hash, applies an expiration, and returns the shareable `/join?invite=...` link once. Ownership transfer is intentionally not smuggled into the invitation workflow; inviting directly as `owner` is rejected.

Member removal also protects the sole owner and rejects self-removal because the source defines Leave Organization as a separate destructive workflow.

## Profile Complete versus Verified

Profile completion is a readiness state, not a credibility assertion.

`profile_complete` requires the profile-owned required facts:

- organization display identity
- Organization Type
- organization description
- primary organizational contact
- at least one organization participation role
- visibility choices
- at least one first-value goal

It does **not** require or create:

- organization verification
- AMACS mapping
- capability evidence
- capability verification
- paid membership

Verified Information is read from `organization_verifications`; if there are no verification assertions, the UI says so rather than manufacturing a badge.

## Persistence

`db/organization-profile.sql` now provides the profile-specific persistence for:

- `organization_profiles`, including `organization_type`
- `organization_contacts`
- `organization_verifications`
- `organization_invitations`

and continues to use the chassis tables:

- `organizations`
- `users`
- `organization_memberships`
- `locations`
- `organization_geographies`
- `activity_events`

## Configuration

Required runtime settings:

```text
DATABASE_URL=postgres://...
DATABASE_SSL=require|disable
RFXCHANGE_SESSION_SECRET=<at least 32 characters>
```

The selected production Identity adapter must issue the HMAC-signed `rfx_session` HttpOnly cookie after authentication and active-organization selection. The Organization Profile service will not silently downgrade to a mock actor.

## Static Pages preview

GitHub Pages remains a static visual projection. API routes are removed from the Pages build, so the profile hierarchy can be inspected there but runtime saves require the server-capable deployment. Both the profile root and all child/grandchild routes remain statically exportable; query context is resolved client-side after navigation. The static preview does not create browser-only profile success or pretend that a database write occurred.
