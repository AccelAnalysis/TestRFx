# Resources lens integration

The Resources experience is a lens inside the authenticated RFxchange Exchange chassis. It does not own a second map, search bar, result drawer, card system, detail controller, or bottom navigation.

## Shell contract

When `resources` is active, the chassis keeps the persistent Exchange composition mounted and injects Resource-specific records, action resolution, nested workflow state, detail content, and service calls.

```text
Exchange shell
├── Persistent map                 shared
├── Universal search               shared, Resources placeholder/corpus
├── Floating controls              shared
├── Three-state result drawer      shared
│   ├── Search / Filters / Sort / Geography shell controls
│   ├── Four action positions      shared positions / Resources actions
│   ├── Resources workflow tree    Resources nested navigation
│   └── Resource record cards      shared cards / Resources projection
├── Detail controller              shared / Resources detail body
├── Bottom navigation              shared
└── Shared services
    ├── Referrals
    ├── Authorization
    ├── Activity / audit
    └── Menu → Referrals Management
```

The result drawer remains authoritative: a Resource can be visible in the list without having a map location. Mapped, off-map, and sponsored records are supported without equating map presence with Exchange presence.

## Source-driven workflow hierarchy

The nested Resources hierarchy intentionally follows the source flow and does not add extra product branches.

```text
Resources
├── My Organization’s Resources
│   ├── Offer Resource
│   │   └── Offer Resource modal
│   ├── Edit Resource
│   │   └── Manage / Edit Resource
│   ├── Share
│   │   └── Share menu / send resource
│   └── Save / Archive
│       └── Save or Archive action
│
├── Resources from Other Organizations
│   ├── Request Resource
│   │   └── Request Resource modal
│   ├── View Resource Detail
│   │   └── Resource detail view
│   ├── Share
│   │   └── Share menu / send to another organization
│   └── Save
│       └── Save / follow action
│
└── Cross-lens Referral Workflow
    └── Refer from resource result or detail
        └── Referral modal
            └── Recipient referral policy / fee
                └── Track in Menu → Referrals Management
```

The hierarchy has explicit nested navigation state (`ResourceNavigationState.path`). Closing the hierarchy or changing lenses closes the surface but does not erase the nested path, so reopening it restores the user's location. Search, Filters, Sort, and Geography remain shared Exchange controls rather than duplicate Resources submenu branches.

## Ownership-aware action rail

The four chassis positions remain stable while the Resources actions match the source.

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Offer | Request |
| 2 | Edit | View Detail |
| 3 | Share | Share |
| 4 | Save / Archive | Save → Save / Follow |

Referral is not inserted into a fifth action slot. It is reachable from the Resource result card, Resource Detail, and the Resources hierarchy because the source defines it as a cross-lens workflow.

## Resource services

Resource mutations no longer report success from local React state. They call authenticated server routes backed by the Resources domain service and PostgreSQL/PostGIS target schema.

```text
Resources UI
   ↓
/api/exchange/resources/*
   ↓
server actor / organization membership resolution
   ↓
Resources service
   ├── offer / edit / archive
   ├── request
   ├── save / follow relationships
   ├── share / send-to-organization
   └── activity events
   ↓
PostgreSQL / PostGIS
```

The server resolves the actor from the `rfx_user_id` and `rfx_organization_id` secure session bridge (or server-only configured IDs in a development deployment), validates the organization membership, and applies role/permission checks before mutations. Missing database/session configuration returns a service error; the client does not simulate success.

### Offer Resource

`POST /api/exchange/resources` creates the canonical `exchange_records` identity and the Resource domain row in one database transaction. A public organization location is attached only when the user selects public-location visibility and the organization has a stored point. The service never fabricates a map location.

### Manage / Edit Resource

`PATCH /api/exchange/resources/{recordId}` validates ownership and Resource management permission, updates the shared Exchange projection and Resource domain fields, and records an activity event.

### Save or Archive

Save persists a `saved` Resource relationship. Archive validates ownership, marks both the Resource and shared Exchange record archived, removes it from active discovery, and writes an activity event.

### Request Resource

`POST /api/exchange/resources/{recordId}/requests` creates a durable `resource_requests` record. Requests are transactions against an offered Resource; they are not a second public Resource listing type. The schema supports the source lifecycle transition from `submitted` to `connected`/`closed` without inventing another Resources navigation branch.

### Share / send resource

`POST /api/exchange/resources/{recordId}/shares` resolves the receiving organization and persists the send operation in `resource_shares`. Resources no longer routes Share through a generic clipboard-only behavior.

### Save / follow

`PUT /api/exchange/resources/{recordId}/relationships` persists the exact source relationship choices: `saved` and `following`.

## Cross-lens referral service

The Resources referral flow uses shared referral routes rather than a Resources-only referral database.

```text
Resource result or detail
   ↓
Referral modal
   ↓
GET /api/exchange/referrals/policy
   ↓
Recipient referral policy / fee review
   ↓
POST /api/exchange/referrals
   ↓
Menu → Referrals Management
   ↓
GET /api/exchange/referrals
```

The referral write snapshots the recipient's currently published policy/fee text, links the Resource Exchange record, stores the sender/recipient organizations and actor, and emits a `ReferralCreated` activity event. Menu → Referrals Management now includes a live tracking panel for sent and received referrals instead of leaving this source step as a disabled placeholder.

## Persistence targets

The Resources portion of `db/schema.sql` now includes:

- Resource category, availability, capacity, service-area label, visibility, terms, status, and sponsored state;
- `resource_requests`;
- durable Resource `saved` / `following` relationships;
- `resource_shares`;
- recipient `referral_policies`;
- referrals with actor, message, policy snapshot, and fee snapshot;
- `activity_events` for meaningful Resource/referral changes.

## Preview versus runtime

The repository retains deterministic Resources for the static GitHub Pages projection because GitHub Pages has no runtime database or API. In a runtime deployment, the client hydrates Resources from `GET /api/exchange/resources`. If the database/session boundary is unavailable, static/reference records may remain visible for presentation, but create/edit/request/share/save/follow/archive/referral actions fail visibly rather than mutating fake local domain state.

The stable chassis remains unchanged: map, universal search, drawer, card framework, detail controller, bottom navigation, and Menu continue to be shared platform primitives while Resources supplies its domain behavior through governed contracts.
