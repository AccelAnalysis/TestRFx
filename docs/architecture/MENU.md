# Authenticated Exchange Menu

## Purpose

Menu is the authenticated Exchange's cross-cutting utility and administration gateway. It is **not** a fifth Exchange lens.

The persistent lens set remains:

- RFx
- Resources
- Intelligence
- Capabilities

Menu opens above that mounted Exchange state and provides organization, person/account, referral, communication, saved/watch, commercial, privacy, support, and session utilities. Closing Menu returns the member to the same Exchange context.

## Operating-chassis boundary

The shell owns:

- the persistent RFx / Resources / Intelligence / Capabilities / Menu bottom navigation;
- opening and closing the Menu overlay;
- preserving the active lens, map, query, drawer, selected record, and detail context underneath Menu;
- responsive mobile-sheet and desktop-side-surface behavior;
- accessible dialog semantics and Escape/back behavior;
- the stable Menu destination registry;
- progressive-availability presentation for utility integration points.

The utility domains own their business logic and persistence. Menu must not duplicate those services.

## Canonical Menu structure

The governed top-level order is:

1. Organization Profile
2. My Profile
3. Security & Account
4. Settings
5. Referrals Management
6. Messages & Notifications
7. Saved & Watchlist
8. Billing & Membership
9. Privacy & Data
10. Help & Support
11. About RFxchange
12. Sign out

The implementation groups these visually for scanning, but does not change the canonical ordering or ownership semantics.

## Organization Profile

Organization Profile is the administrative view of the same canonical organization used throughout the Exchange. It is not a second capability or organization application.

The Menu contract reserves utility actions for:

- organization details;
- verified information;
- Capabilities / AMACS administration;
- locations;
- team members, roles, invitations, and permissions;
- documents and evidence;
- brand and Exchange visibility;
- leaving the organization;
- transferring ownership;
- deactivation;
- organization deletion.

`Capabilities / AMACS` must hand into the same capability identity used by onboarding, search, matching, referrals, RFx, Intelligence, and the Capabilities lens. It must not create a Menu-specific capability store.

## Person versus organization

Menu keeps person-level and organization-level identity separate:

```text
Person
  ├── profile
  ├── authentication
  ├── sessions/devices
  ├── preferences
  └── linked organizations

Person
  └── organization membership
        ├── role
        └── permissions
              ↓
        Active organization
              ├── profile
              ├── locations
              ├── capabilities
              ├── verification
              ├── team
              ├── commercial membership
              └── Exchange activity
```

If a member belongs to more than one organization, the active organization switcher belongs at the top of Menu. Switching organizations is a context operation; it must re-resolve permissions, ownership, commercial membership, and downstream action availability.

## Referrals are cross-lens

Referral creation may originate from RFx, Resource, Intelligence, Capability, or organization context, but referral administration belongs in Menu.

```text
RFx ───────────┐
Resource ──────┤
Intelligence ──┼── Refer ──> Referral engine
Capability ────┤                  │
Organization ──┘                  ▼
                         Menu > Referrals Management
```

Referrals therefore remain outside `ExchangeLens` and must not be added back to persistent bottom navigation.

Menu reserves management destinations for overview, lifecycle, referral policy, payments/payouts, reporting, and creation. The production referral service remains authoritative for referral eligibility, terms, status, fees, payouts, and audit history.

## Messages and notifications

Messages and notifications share one Menu entry but remain distinct concepts.

- Messages are conversations/inbox items.
- Notifications are event-driven platform alerts.

Production RFx, Resource, Capability, Intelligence, referral, organization, membership, and account services should emit events into one shared notification service instead of building lens-specific notification centers.

## Saved and watch relationships

Menu presents saved and watched relationships across record classes. The production relationship service should normalize these relationships rather than having each lens own a separate save implementation.

The current contract includes saved organizations, RFx, resources, watched RFx, and watched organizations, and is intentionally extensible to other Exchange record classes.

## Billing and membership

Billing & Membership is generally scoped to the active organization. It should resolve commercial membership separately from user-to-organization membership.

The Menu contract reserves:

- current plan / entitlement state;
- plan changes;
- payment methods;
- invoices;
- organization credit ledger;
- membership lifecycle.

Production billing must enforce server-side organization authority, capacity rules, Stripe/payment reconciliation, credit rules, and entitlement changes. The Menu client must not infer commercial truth from UI state.

## Destructive-action policy

Sign out, leave organization, transfer ownership, deactivate/delete organization, sign out all devices, and delete personal account are governed actions.

A production destructive-action controller should apply the appropriate combination of:

1. server-side authorization;
2. dependency checks;
3. impact review;
4. acknowledgement;
5. re-authentication where required;
6. final confirmation;
7. transactional mutation;
8. audit/activity event emission;
9. downstream notification.

The reference chassis does not simulate these mutations. It exposes their stable UI positions and marks the production service boundary explicitly.

## Progressive availability

Menu uses the same architectural principle as the lens action rail: intended functionality may be visible before the backing workflow is operational.

A Menu action therefore carries an availability state. In the reference implementation, downstream utility workflows are shown as `integration` points rather than fake operational actions.

Production services may make those actions operational without changing the Menu information architecture.

## Responsive behavior

Mobile:

- Menu opens as a near-full-height bottom sheet over the current Exchange.
- The Exchange remains visually present beneath the backdrop.
- Nested utility areas remain within the Menu controller rather than routing into unrelated full-page applications.

Desktop:

- Menu becomes a right-side utility surface over the persistent Exchange.
- The same hierarchy and contracts are preserved.

## State continuity

Opening Menu must not mutate the active Exchange view state.

At minimum, the following remain mounted underneath the overlay:

- active lens;
- search query and future structured filters/sort;
- map camera / geography state;
- drawer state;
- selected record;
- list position;
- detail state where applicable.

The current chassis already preserves these values because `MenuSurface` is mounted as an overlay rather than a route-level replacement.

## Integration services

The production Menu ultimately consumes shared platform services:

```text
Menu
├── Identity / session service
├── Organization / membership / permissions service
├── Capability / AMACS service
├── Referral service
├── Relationship service (save/watch/follow)
├── Communications / notification service
├── Commercial membership / billing / credit service
├── Privacy / consent / data-request service
├── Support service
└── Audit / activity event service
```

The dependency direction is important: these services plug into Menu. They do not get to create additional persistent lenses or independent application shells.

## Current reference implementation

This branch adds:

- `lib/exchange/menu.ts` as the stable utility registry and availability contract;
- a hierarchical `MenuSurface` with organization context, section drill-in, source-defined utility destinations, destructive-action boundaries, Escape/back behavior, and responsive presentation;
- explicit Menu dialog state on the existing bottom navigation;
- progressive-availability labels so non-operational services are visible without being falsely represented as complete.

The reference member and organization values are deterministic chassis context only. Production authenticated viewer, active organization, roles, permissions, membership, counts, notification state, and utility availability must be supplied by server-backed application services.
