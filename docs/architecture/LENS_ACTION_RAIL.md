# Lens Action Rail

The Lens Action Rail is a shared RFxchange operating-chassis primitive inside the **Authenticated Exchange Shell**. It occupies four permanent positions above the result cards and translates the active lens plus the current record/organization context into the next governed actions.

It is not a fifth lens, a page header, or a domain-specific toolbar. RFx, Resources, Intelligence, and Capabilities plug their actions into the same four slots.

## Chassis placement

```text
Authenticated Exchange Shell
├── Persistent Map
├── Universal Search
├── Floating controls
├── Sliding result drawer
│   ├── Results / Sort / Filter
│   ├── Lens Action Rail  ← this module
│   └── Record cards
├── Detail surfaces
├── Bottom navigation
└── Shared workflows/services
```

The rail is rendered in both the result drawer and the shared detail surface. Opening detail therefore does not replace the action model or create a separate domain UI.

## Four-slot contract

Every resolved action set must contain exactly four ordered positions. The positions are stable; labels and workflows change with context.

`LensAction` keeps separate state for:

- `visible`
- `applicable`
- `authorized`
- `operational`
- `prerequisitesSatisfied`

Those fields must not be collapsed into one generic `disabled` flag. A workflow that is not released is different from an action that does not apply to the selected record or an action the viewer is not authorized to perform.

The current reference implementation deliberately leaves production authorization and onboarding prerequisite resolution as integration seams. The client presentation is not an authorization boundary.

## Ownership context

The source flows repeatedly distinguish **Own View** from **Others View**. The reference chassis currently derives that distinction from `ExchangeRecord.ownedByViewer`; production must derive it from authenticated user + active-organization membership and server-side record ownership/authority.

```text
selected record
    │
    ├── owned by active organization → own action set
    └── otherwise                    → other action set
```

## Governed action matrix

### RFx

The RFx source contains a broader own-organization lifecycle (create, draft/save/publish, manage, invite, track/watch, responses/matches) and an others lifecycle (view, respond, team, watch, refer). The chassis rail binds four primary contextual positions from those branches:

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Create RFx | View Detail |
| 2 | Manage | Respond |
| 3 | Invite Team | Team |
| 4 | Watch | Watch |

The RFx source also shows a separate sticky quick-action reference (`View`, `Match`, `Refer`, `Save`). That source behavior is not silently treated as identical to the record-bound own/other action branch. Match/referral workflows remain domain/cross-lens integration points and can be promoted through the governed registry when the RFx product contract calls for them.

### Resources

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Offer | Request |
| 2 | Edit | View Detail |
| 3 | Share | Share |
| 4 | Save / Archive | Save |

This follows the Resource source's explicit Own View and Others View columns. Resource referral remains a cross-lens workflow rather than consuming a permanent Resource slot.

### Intelligence

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Add Insight | View Detail |
| 2 | Edit Insight | Add Note |
| 3 | Compare | Compare |
| 4 | Track | Follow / Track |

The source also identifies referral as a downstream cross-lens trigger rather than a permanent Intelligence lens action.

### Capabilities

| Position | Own organization | Other organization |
| --- | --- | --- |
| 1 | Manage | View |
| 2 | AI → AMACS | Match to RFx |
| 3 | Evidence | Refer |
| 4 | Gaps | Save / Follow |

The own branch is the ongoing continuation of onboarding capability enrichment; onboarding initializes organization capability context, while the authenticated Capabilities lens becomes the durable management/discovery surface.

## Trigger types

Actions declare how they enter the rest of the chassis:

- `detail` — open the shared detail controller
- `modal` — open a bounded modal workflow
- `menu` — open a management/utility surface
- `direct` — perform a reversible shell-level action such as Save, Watch, Track, Follow, or Share
- `workflow` — enter a cross-record/domain workflow such as Team, Match, Compare, AMACS mapping, evidence, or Referral

The rail dispatches intent; it does not implement RFx submission, AMACS mapping, referral policy, resource fulfillment, or intelligence calculations itself.

## Progressive availability

Unavailable workflows stay in their governed position rather than causing the rail to reflow. The reference UI labels unreleased actions as `Soon` and exposes the unavailable reason through the accessible name/title.

Examples intentionally left non-operational until their product/service modules are connected include:

- RFx Create / Manage / Respond / Team
- Resource Offer / Edit / Request / Archive lifecycle
- Intelligence Add / Edit / Note / Compare
- Capability Manage / AI → AMACS / Evidence / Gaps / Match
- Cross-lens Refer

Reference direct actions are live enough to prove the chassis contract:

- View opens the existing shared detail surface
- Save / Watch / Track / Follow toggle in mounted shell state
- Share uses the browser share sheet when available and otherwise copies a deep link

These are reference behaviors, not a claim of canonical server persistence.

## State continuity

Action execution must not destroy Exchange context. The existing shell remains mounted and retains lens, query, selected record, map context, drawer state, and list position while detail/Menu/workflows overlay it.

Direct action state is currently mounted client state, with seeded `saved` state respected where present. Production persistence should plug into authenticated favorites/watch/follow repositories and emit activity events without changing the four-slot UI contract.

## Production integration points

The next adapters should supply:

1. authenticated viewer and active organization
2. server-derived ownership
3. role/permission authorization
4. onboarding/profile/capability prerequisites
5. feature/workflow operational state
6. domain action executors
7. persistent Save/Watch/Track/Follow state
8. cross-lens referral composer and policy
9. activity/audit/notification events

The server/domain workflow remains responsible for re-validating authorization and record state when an action is executed.

## Source alignment rule

RFxchange remains one application with four Exchange lenses. Product modules may add domain data, action executors, detail content, filters, or map layers, but they should not create another action bar, change the four-slot shell contract, or bypass the shared authorization/availability vocabulary.
