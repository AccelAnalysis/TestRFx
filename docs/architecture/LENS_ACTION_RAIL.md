# Lens Action Rail

The Lens Action Rail is a shared RFxchange operating-chassis primitive inside the **Authenticated Exchange Shell**. It occupies four permanent positions above the result cards and exposes commands that operate on the **active lens as a whole**.

The rail is deliberately separate from record actions. Selecting a marker or card does not repurpose the four rail positions. Record-specific commands live on the record card and in the shared detail surface.

## Chassis placement

```text
Authenticated Exchange Shell
├── Persistent Map
├── Universal Search
├── Floating controls
├── Sliding result drawer
│   ├── Results / Sort / Filter
│   ├── Lens Action Rail      ← lens-wide commands
│   └── Record cards
│       └── Record Action Row ← commands for that record
├── Detail surfaces
├── Bottom navigation
└── Shared workflows/services
```

The rail remains visible even when a lens currently has zero results. A user must never need to select a marker or record before a legitimate lens-level workflow such as **Create RFx** becomes discoverable.

## Four-slot contract

Every resolved lens-control set contains exactly four ordered positions. The positions are stable, while the actual controls are resolved from the active lens plus authenticated viewer/organization context.

A lens does **not** imply that every participant can perform every producer-side action. For example, opening Resources does not make the active organization a Resource Provider. An inapplicable producer command is replaced by a useful discovery command rather than left as a permanently disabled control.

`LensAction` preserves separate state for:

- `scope` (`lens` or `record`)
- `visible`
- `applicable`
- `authorized`
- `operational`
- `prerequisitesSatisfied`

The client presentation is not an authorization boundary. Production identity/domain services must supply and re-validate organization eligibility, user role, permissions, entitlement, prerequisites, and workflow readiness.

## Viewer and organization context

The action resolver consumes an `ExchangeViewerContext` containing the capabilities needed by the shell, currently including whether the viewer may issue RFx, respond to RFx, offer/request Resources, contribute Intelligence, or manage Capabilities.

The TestRFx reference shell derives conservative defaults from its owned fixture records so the interaction can be exercised today. `ExchangeShell` also accepts a viewer-context override as the seam for server-authoritative identity and policy claims. Production must replace fixture inference with authenticated active-organization membership and policy resolution.

## Current lens-control matrix

The current assignments deliberately use only workflows or filters that already exist in TestRFx.

### RFx

For a viewer whose organization can issue RFx:

| Position | Control | Function |
| --- | --- | --- |
| 1 | Create RFx | Starts the issuer creation hierarchy without requiring a record selection |
| 2 | My RFx | Shows organization-owned RFx records |
| 3 | Watched | Shows watched/saved RFx records |
| 4 | All | Restores the full RFx result set |

For a viewer without issuer capability:

| Position | Control | Function |
| --- | --- | --- |
| 1 | Watched | Shows watched RFx |
| 2 | Mapped | Shows RFx with map locations |
| 3 | Off-map | Shows valid RFx without point locations |
| 4 | All | Restores the full RFx result set |

### Resources

For an organization that can offer Resources:

| Position | Control | Function |
| --- | --- | --- |
| 1 | Offer | Opens the existing Resource offer workflow |
| 2 | My Listings | Shows organization-owned Resource listings |
| 3 | Saved | Shows saved Resource records |
| 4 | All | Restores the full Resource result set |

For a viewer/organization that is not a Resource Provider, **Offer** and **My Listings** are not shown merely because the Resources lens is active. The rail resolves to Saved / Mapped / Off-map / All discovery controls instead.

### Intelligence

Contributors receive Add Insight / Tracked / Mapped / All. Non-contributors receive Tracked / Mapped / Off-map / All.

### Capabilities

Authorized capability managers receive My Capabilities / Manage / Following / All. Other viewers receive Following / Mapped / Off-map / All.

## Record actions are not rail actions

The following behavior belongs to the record card/detail surface rather than the lens rail:

- RFx Respond, Team, Manage, Invite Team, Share
- Resource Request, Edit, Archive, Share
- Intelligence Add Note, Edit, Compare, Share
- Capability Match RFx, Refer, Manage, Evidence, AMACS, Gaps, Share

Likewise, **View Detail** is not a rail command. Tapping the card body opens detail, making the target unambiguous.

Save/Watch/Follow is represented by the card star rather than duplicated in each card's action row. Lens-level Watched/Saved/Following controls can filter the result set without duplicating the per-record toggle.

## No implicit first-result selection

The chassis must never infer that the first result is the selected record. `selectedRecordId` remains empty until the user selects a marker/card or enters through a record deep link. Lens controls therefore cannot accidentally operate on `records[0]`.

## Trigger types

Actions declare how they enter the rest of the chassis:

- `detail` — open the shared detail controller
- `modal` — open a bounded workflow surface
- `menu` — open a management/utility surface
- `direct` — perform a shell-level command such as applying a result scope or sharing a record
- `workflow` — enter a domain/cross-record workflow

The action registry dispatches intent; it does not replace domain authorization or transaction logic.

## Availability rule

Use disabled states for applicable but temporarily unavailable conditions, such as an unreleased workflow, missing prerequisite, entitlement, or user-level permission that can be resolved.

Do not use a disabled button to represent an organization type or participation mode that does not apply. Inapplicable commands should be replaced/omitted by the resolver. That keeps the four-slot rail useful for buyers, issuers, providers, seekers, contributors, managers, and ordinary viewers without redesigning the shell.

## State continuity

Changing lens scope through My / Saved / Mapped / Off-map / All updates the existing drawer query while preserving the active lens and sort. Action execution must not destroy map/search/drawer/detail continuity.

## Production integration points

The next identity/policy adapter should supply:

1. authenticated viewer and active organization
2. organization participation/eligibility
3. user role and permissions
4. server-derived record ownership
5. membership/entitlement state
6. onboarding/profile prerequisites
7. feature/workflow operational state
8. domain action executors
9. activity/audit/notification events

The server/domain workflow remains responsible for re-validating authorization and current record state when an action executes.

## Source alignment rule

RFxchange remains one application with four Exchange lenses. Product modules may add domain data, action executors, detail content, filters, or map layers, but they should not create another lens toolbar, move record actions back into the lens rail, or bypass the shared authorization/availability vocabulary.
