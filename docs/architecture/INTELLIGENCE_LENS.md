# Authenticated Exchange → Intelligence Lens

## Purpose

Intelligence is the analytical lens of the authenticated RFxchange Exchange. It stays inside the persistent map/search/result-sheet/card/detail/bottom-navigation chassis while supplying Intelligence-specific records, actions, hierarchy, persistence, provenance, comparison, tracking, matching, and referral context.

It is not a separate BI application and it does not introduce another bottom-navigation destination.

## Source-defined hierarchy

The source flow starts at **Search / Filter / Map / Result Sheet**, branches by ownership, then moves through an action, a source-defined result, and the same four outcomes.

```text
Intelligence
├── Own View
│   ├── Add Insight [Modal]
│   │   └── Insight record updated
│   ├── Edit Insight [Menu]
│   │   └── Insight record updated
│   ├── Compare [Modal]
│   │   └── Analyze patterns / compare intelligence
│   └── Track [Action]
│       └── Follow changes / watch intelligence activity
│
└── Others View
    ├── View Insight Detail [Menu]
    │   └── Review intelligence context
    ├── Add Note [Modal]
    │   └── Contribute note or commentary
    ├── Compare [Modal]
    │   └── Compare external intelligence
    └── Follow / Track [Action]
        └── Monitor updates and changes
```

Every result node has exactly these source-defined outcomes:

```text
Result
├── Decision Support
├── Opportunity / Capability Matching
├── Referral Trigger (Cross-Lens)
│   └── Create Referral
└── Save / Watch / Return to Exchange
```

No sibling children are added beyond the supplied source. `Referral Trigger → Create Referral` is the only explicit additional grandchild in the source diagram.

## Nested navigation state

`lib/exchange/intelligence.ts` defines the canonical `IntelligenceNavigationNode` tree. The mounted Exchange shell stores an explicit navigation stack rather than treating menus as one-off popovers.

The navigation surface provides:

- parent/child traversal;
- breadcrumbs to any already traversed ancestor;
- Back to the previous hierarchy level;
- Escape to go back one level before closing;
- the selected Intelligence record as retained context;
- action/result/outcome identity across modal completion;
- exact return to the mounted Exchange state when the workflow closes.

Modal actions advance into their result node after the server confirms completion. Menu actions first enter their source-defined menu node. Direct Track/Follow actions advance to their result node only after persistence succeeds.

## Real runtime services

The Intelligence lens no longer consumes deterministic Intelligence seed data or mounted-session persistence.

### Database runtime

`lib/server/database.ts` connects the application to PostgreSQL/PostGIS with the `postgres` client. `DATABASE_URL` is mandatory. Missing configuration returns a service-unavailable response; it does not activate a fixture fallback.

### Authenticated Exchange actor

`lib/server/exchange-session.ts` requires an `rfx_session` cookie. The raw token is SHA-256 hashed and resolved against `exchange_sessions`, the user’s organization membership, and the active organization.

`db/exchange-sessions.sql` persists only token hashes plus user/organization/session lifecycle metadata. A production Identity provider is responsible for creating the raw secure session token and setting it as an HttpOnly, Secure, SameSite cookie after successful authentication/readiness resolution.

There is no development/fake actor fallback in the Intelligence APIs.

### Intelligence repository

`lib/server/intelligence-repository.ts` reads and writes canonical Exchange data:

- `exchange_records`;
- `intelligence_records`;
- `intelligence_sources`;
- `intelligence_notes`;
- `intelligence_tracking`;
- `intelligence_relationships`;
- `referrals`;
- `activity_events`;
- `organizations` / `organization_memberships`;
- `locations` / PostGIS points.

The common `ExchangeRecord` remains the shell projection. Intelligence-specific truth stays in the domain tables.

## Authenticated API

The client uses real same-origin API calls through `lib/exchange/intelligence-client.ts`.

| Route | Purpose |
| --- | --- |
| `GET /api/exchange/intelligence` | paginated Intelligence discovery |
| `POST /api/exchange/intelligence` | create an owned insight |
| `GET /api/exchange/intelligence/:recordId` | canonical detail, sources, provenance, notes, tracking, relationships |
| `PATCH /api/exchange/intelligence/:recordId` | edit an owned insight |
| `POST /api/exchange/intelligence/:recordId/notes` | persist a personal/organization/shared note |
| `PUT /api/exchange/intelligence/:recordId/tracking` | persist Track or Follow state |
| `POST /api/exchange/intelligence/compare` | compare canonical source records |
| `GET /api/exchange/intelligence/:recordId/matches` | find relevant RFx/capability records |
| `POST /api/exchange/intelligence/:recordId/referrals` | create the cross-lens referral |

The client surfaces 401/403/404/503/500 states instead of pretending an action succeeded.

## Search, map, result sheet, and pagination

The source’s Search / Filter / Map / Result Sheet entry remains a chassis concern.

Intelligence list requests are server-backed and paginated. The shared three-state `ResultsDrawer` uses its existing infinite-load contract to fetch additional pages. The drawer remains authoritative because records can be mapped or off-map.

Geolocated Intelligence records use persisted `locations.point` coordinates. Records without a location remain in the result sheet and receive no invented coordinates.

The old fabricated Intelligence heat treatment has been removed. Intelligence currently uses real record points/clusters only. A future heat/polygon/temporal layer must be supplied by a governed aggregation service and real source data before it is rendered.

## Add / Edit Insight

Add and Edit write to the canonical repository after server-side authorization.

The workflow captures:

- title;
- observation/summary;
- geography;
- signal type;
- observation start/end dates;
- source type;
- source label;
- optional source URL.

The allowed runtime source classes are:

- `participant-observation`;
- `exchange-activity`;
- `external-dataset`.

The former non-production `reference-dataset` source class is not created by the runtime.

Creation/edit also emits `activity_events` and records provenance metadata. Ownership is verified against the authenticated active organization; client `ownedByViewer` is only a projection.

## Notes

Notes do not mutate the originating Intelligence record. They are persisted separately with one of the source-supported visibility policies already modeled by the platform:

- personal;
- organization;
- shared.

Read access is filtered server-side according to visibility, current user, and active organization.

## Compare

The source explicitly says Compare can operate across:

- **insights**;
- **organizations**;
- **geographies**.

The modal exposes only those three dimensions. It queries canonical Intelligence records for both sides and displays actual source-backed records, signal types, locations, and observation windows. Missing values remain missing; the comparison does not synthesize a score or turn absence into zero.

## Track / Follow

Track and Follow persist to `intelligence_tracking`. The relationship is scoped to the authenticated user and active organization and distinguishes `track` from `follow` mode.

The shared card favorite position is bound to this persisted relationship for Intelligence rather than to mounted component state. Tracking changes emit activity events.

## Detail and provenance

The shared Detail Controller now loads Intelligence-specific detail from the authenticated service rather than from a fixture map.

It presents:

- signal type;
- observation window;
- source class;
- source records;
- source URLs/publishers when present;
- provenance metadata;
- related capabilities;
- related organizations;
- visible notes;
- Track/Follow state.

## Decision Support

Decision Support is a source-defined outcome, not an invented analytics product. The current leaf exposes the same canonical detail/provenance context so the user can make a decision from known source material. It does not fabricate a recommendation, market forecast, confidence score, or AI conclusion.

## Opportunity / Capability Matching

The matching outcome queries real `exchange_records` for RFx and Capability records using PostgreSQL full-text relevance plus Exchange geography. Returned candidates include the actual record identity, organization, geography, and transparent match reasons.

Selecting a candidate hands the user back into the existing RFx or Capabilities lens rather than creating an Intelligence-owned copy of those workflows.

## Referral Trigger → Create Referral

Referrals remain cross-lens.

The source-defined `Create Referral` child uses real matching results to identify candidate recipient organizations and writes to the shared `referrals` table with:

- sender organization from the authenticated session;
- selected recipient organization;
- the referenced Intelligence `exchange_record_id`;
- proposed status;
- optional note/context;
- actor metadata in the referral terms payload.

A `ReferralCreated` activity event is emitted. The workflow exposes the source-defined Cancel and Create Referral actions and returns the real referral ID/status after creation.

## Save / Watch / Return to Exchange

The outcome closes the nested Intelligence surface without replacing the Exchange shell. Persisted Track/Follow state remains in the repository and the user returns to the existing lens, search, map, result sheet, selection, and drawer context.

## Static GitHub Pages preview

GitHub Pages has no authenticated server/API runtime. `scripts/prepare-pages-preview.mjs` removes API routes only in the ephemeral Pages build and deliberately does **not** inject Intelligence records.

Therefore the static preview can show the Intelligence lens/chassis composition, but authenticated Intelligence records and workflows are unavailable there. This is intentional: the preview does not carry a hidden mock dataset or fake authenticated user.

## Runtime prerequisites

To exercise real Intelligence end to end:

1. provision PostgreSQL with PostGIS;
2. apply `db/schema.sql`;
3. apply `db/intelligence.sql`;
4. apply `db/exchange-sessions.sql`;
5. configure `DATABASE_URL` (and `DATABASE_SSL` when needed);
6. have the production Identity boundary issue a valid `rfx_session` for a user with an active organization membership.

If these prerequisites are absent, the user receives a truthful unavailable/authentication state.

## Privacy and market-truth rules

The implementation preserves these boundaries:

- participant Exchange activity is not presented as a census of the economy;
- source and derived values remain distinguishable;
- missing data is not zero;
- private note scopes are enforced server-side;
- source URLs and provenance remain attached to Intelligence records;
- no heat/density inference is shown without a governed aggregation source;
- paid membership does not create verification, endorsement, or analytical credibility.

## Chassis dependency direction

The governing rule remains:

> Intelligence plugs into the RFxchange operating chassis; it does not recreate the chassis.

The persistent map, Universal Search, result drawer, card framework, action positions, detail controller, bottom navigation, URL state, and cross-lens workflow boundaries stay shared platform primitives.