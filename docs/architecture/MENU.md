# Authenticated Exchange Menu

## Purpose

Menu is the authenticated Exchange's cross-cutting utility and administration gateway. It is **not** a fifth Exchange lens.

The persistent lens set remains:

- RFx
- Resources
- Intelligence
- Capabilities

Menu opens above the mounted Exchange state. Closing Menu returns the member to the same lens, map, search, drawer, selection, and detail context.

## Operating-chassis boundary

The shell owns:

- persistent RFx / Resources / Intelligence / Capabilities / Menu bottom navigation;
- opening and closing the Menu overlay;
- nested Menu navigation state and Back/Escape behavior;
- responsive mobile-sheet and desktop-side-surface composition;
- the stable Menu hierarchy and destination contract;
- progressive-availability presentation.

The utility domains own their business logic, authorization, persistence, and final execution. Menu must not duplicate those services.

## Canonical top-level order

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

## Hierarchical Menu contract

The initial Menu build correctly reserved the top-level sections, but flattened deeper destinations into action rows. The complete contract now uses a navigable `MenuNode` tree.

Each node may define:

```text
id
label
description
scope
kind
surface
availability
destructive?
requiredRole?
destination?
details?
children?
```

Node kinds are:

```text
section
submenu
task
workflow
confirmation
handoff
```

Surface kinds are:

```text
overview
list
form
detail
sequence
handoff
```

The important availability rule is:

> Structural navigation may be available before the production workflow is operational.

A member may therefore navigate Menu → Organization Profile → Organization Administration → Delete Organization → Step 1 Impact Review even while the final delete mutation remains disabled. The hierarchy is stable; the service integration determines whether execution is operational.

## Complete source-derived Menu tree

```text
Menu
│
├── Organization Profile
│   ├── Organization Details
│   ├── Verified Information
│   ├── Capabilities / AMACS
│   ├── Locations
│   ├── Team Members
│   │   ├── Team List
│   │   ├── Roles & Permissions
│   │   ├── Invitations
│   │   └── Access Management
│   ├── Documents & Evidence
│   ├── Brand & Visibility Settings
│   ├── Edit / Manage Organization
│   │   ├── Basic Information
│   │   ├── Contact & Address
│   │   ├── Industry & Codes
│   │   ├── Certifications
│   │   ├── Description
│   │   └── Logo & Branding
│   └── Organization Administration
│       ├── Leave Organization
│       ├── Transfer Organization Ownership
│       │   ├── Select New Owner
│       │   ├── Review Impact
│       │   └── Confirm Transfer
│       ├── Remove Team Member
│       ├── Deactivate Organization
│       └── Delete Organization [Admin / Owner]
│           ├── Step 1 — Impact Review
│           ├── Step 2 — Confirm Identity
│           └── Final Confirmation
│
├── My Profile
│   ├── Edit Profile
│   │   ├── Personal Information
│   │   ├── Contact Details
│   │   └── Profile Photo
│   ├── Role & Permissions
│   └── Linked Organizations
│       ├── Organizations You Belong To
│       ├── Switch Active Organization
│       └── Set Default Organization
│
├── Security & Account
│   ├── Change Password
│   ├── Multi-Factor Authentication (MFA)
│   ├── Authentication Methods
│   ├── Active Sessions / Devices
│   ├── Sign Out of All Devices
│   └── Danger Zone
│       └── Delete Personal Account
│           ├── Step 1 — Impact Review
│           ├── Step 2 — Confirm Identity
│           └── Final Confirmation
│
├── Settings
│   ├── Application Preferences
│   ├── Notification Preferences
│   ├── Privacy Preferences
│   └── General Preferences
│
├── Referrals Management
│   ├── Overview
│   │   ├── Summary
│   │   ├── In Progress
│   │   ├── Completed
│   │   └── Earnings
│   ├── Referrals
│   │   ├── Sent Referrals
│   │   ├── Received Referrals
│   │   ├── In Progress
│   │   ├── Completed / Won
│   │   └── Closed / Lost
│   ├── Referral Policies
│   │   ├── My Referral Policy
│   │   ├── Payout Terms
│   │   ├── Minimums & Rules
│   │   └── Eligibility Criteria
│   ├── Payments & Payouts
│   │   ├── Earnings Summary
│   │   ├── Payout History
│   │   ├── Pending Payouts
│   │   └── Payment Methods
│   ├── Reports
│   │   ├── Performance
│   │   ├── Conversion Rates
│   │   ├── Top Referrers
│   │   └── Trend Analysis
│   ├── Create Referral
│   │   ├── Select Organization
│   │   ├── Select Recipient
│   │   ├── Attach Context
│   │   │   ├── RFx
│   │   │   ├── Resource
│   │   │   ├── Capability
│   │   │   └── Intelligence
│   │   ├── Referral Policy Preview
│   │   ├── Notes / Message
│   │   └── Submit Referral
│   └── Referral Details
│       ├── Referral Information
│       ├── Status & Timeline
│       ├── Messages / Notes
│       └── Payout Information
│
├── Messages & Notifications
│   ├── Messages
│   │   ├── All Messages
│   │   ├── Unread
│   │   ├── Archived
│   │   └── Search
│   └── Notifications
│       ├── All Notifications
│       ├── Unread
│       ├── System Alerts
│       ├── Activity Updates
│       └── Mark All Read
│
├── Saved & Watchlist
│   ├── Saved Organizations
│   ├── Saved RFx
│   ├── Saved Resources
│   ├── Watched RFx
│   └── Watched Organizations
│
├── Billing & Membership
│   ├── Current Plan
│   ├── Change Plan
│   │   ├── Compare Plans
│   │   ├── Select Plan
│   │   ├── Review Changes
│   │   └── Confirm
│   ├── Payment Methods
│   ├── Invoices
│   │   ├── Invoice History
│   │   ├── Download PDF
│   │   └── Payment Status
│   ├── Payment History
│   ├── Credits
│   └── Membership Lifecycle
│
├── Privacy & Data
│   ├── Data Download
│   ├── Privacy Controls
│   ├── Consent
│   └── Data Requests
│
├── Help & Support
│   ├── Help Center
│   ├── How-To Guides
│   ├── FAQs
│   └── Contact Support
│
├── About RFxchange
│   ├── About the Platform
│   ├── Terms of Service
│   ├── Privacy Policy
│   ├── Platform Rules
│   ├── Accessibility
│   └── Version Information
│
└── Sign Out
    └── Confirm Sign Out
```

`General Preferences`, `Credits`, `Platform Rules`, and `Accessibility` are intentional platform-level additions from the broader RFxchange architecture. The remaining named nodes above are source-defined Menu concepts or explicit children from the original Menu buildout.

## Nested navigation state

Menu keeps its own navigation stack while the Exchange remains mounted beneath it.

Example:

```text
Exchange state
  lens = capabilities
  query = cybersecurity
  drawer = expanded
  selected = cap-042

Menu stack
  Organization Profile
    → Organization Administration
      → Transfer Organization Ownership
        → Review Impact
```

Back pops one Menu level. Escape does the same. Escape/close at the Menu root dismisses Menu and restores the exact Exchange context that remained mounted underneath.

Breadcrumbs expose the current Menu path and can move directly back to an ancestor.

## Organization Profile

Organization Profile administers the same canonical organization used by RFx, Resources, Intelligence, Capabilities, Referrals, billing, and relationships.

It must not create a Menu-specific copy of organization data.

`Capabilities / AMACS` is a handoff to the same capability identity used by onboarding, search, matching, referrals, RFx, Intelligence, and the Capabilities lens.

Organization editing and organization administration are intentionally separate:

- editing changes descriptive/profile information;
- administration changes membership, ownership, participation state, or organization lifecycle.

## Person versus organization

```text
Person
  ├── personal profile
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

Switching active organization is a context operation. Production must re-resolve permissions, ownership, membership/entitlement state, record ownership, and downstream action availability.

## Referrals are cross-lens

Referral creation may originate from RFx, Resource, Intelligence, Capability, or organization context. Referral administration belongs in Menu.

```text
RFx ───────────┐
Resource ──────┤
Intelligence ──┼── Refer ──> Referral engine
Capability ────┤                  │
Organization ──┘                  ▼
                         Menu > Referrals Management
```

The Menu hierarchy now reserves the full dashboard, lifecycle, policies, payouts, reports, create-referral composer, and referral-detail surfaces from the source flow.

## Messages and notifications

Messages are conversations/inbox items.

Notifications are event-driven platform alerts.

They share one Menu entry but remain separate child surfaces. `Mark All Read` is explicitly represented as a notification workflow rather than being hidden inside generic notification text.

## Saved and watch relationships

Saved and watched records should use one shared relationship service rather than lens-specific save systems.

The current hierarchy includes:

- saved organizations;
- saved RFx;
- saved resources;
- watched RFx;
- watched organizations.

The relationship service may later extend the same contract to Intelligence and other Exchange record classes without creating another Menu architecture.

## Billing and membership

Billing & Membership is scoped to the active organization.

The hierarchy now distinguishes:

- current plan;
- plan-change workflow;
- payment methods;
- invoices and invoice artifacts;
- payment history;
- organization credit ledger;
- membership lifecycle.

Commercial membership remains separate from person-to-organization membership.

## Destructive-action policy

The four source-emphasized destructive actions are:

1. Sign Out
2. Leave Organization
3. Delete Personal Account
4. Delete Organization

Transfer ownership, remove team member, deactivate organization, and sign out all devices are also governed administrative/destructive workflows.

The source defines shared dependency checks before account or organization deletion:

- active membership or unpaid invoices;
- unpaid referral payouts;
- active RFx, resources, or team responsibilities;
- sole administrator / ownership status.

Production execution should apply the appropriate combination of:

1. server-side authorization;
2. dependency checks;
3. impact review;
4. acknowledgement;
5. re-authentication where required;
6. final confirmation;
7. transactional mutation;
8. audit/activity event emission;
9. downstream notification.

The reference chassis exposes the complete navigation/step structure but does not simulate irreversible mutations.

## Progressive availability

Menu uses the same governing distinction as the lens action rail:

```text
visible
applicable
authorized
operational
```

The current reference tree focuses on structural availability and `operational` versus `integration` state. Production policy services should resolve visibility, applicability, and authorization server-side before enabling final execution.

A disabled service must not make its parent Menu path disappear. This keeps product information architecture stable as integrations go live.

## Responsive behavior

Mobile:

- Menu opens as a near-full-height bottom sheet over the current Exchange.
- Child and grandchild surfaces stay in the Menu controller.
- Breadcrumbs and Back expose hierarchy without mounting a parallel app.

Desktop:

- Menu becomes a right-side utility surface over the persistent Exchange.
- The same hierarchy and navigation stack are preserved.

## Integration services

```text
Menu
├── Identity / session / account service
├── Organization profile service
├── Organization membership / permissions service
├── Organization geography service
├── Organization verification service
├── Capability / AMACS service
├── Object storage / media / evidence service
├── Referral / referral policy / payout / reporting services
├── Relationship service (save/watch/follow)
├── Messaging service
├── Notification service
├── Commercial membership / billing / credit services
├── Privacy / consent / data-request service
├── Support service
└── Audit / activity event service
```

These services plug into Menu. They do not get to create new persistent lenses or independent application shells.

## Current reference implementation

The branch now provides:

- a complete hierarchical `MenuNode` tree instead of a flat action list;
- all explicit missing source children identified during review;
- nested navigation stack with Back, Escape, and breadcrumbs;
- real child/grandchild task surfaces inside the Menu overlay;
- explicit multi-step transfer, account deletion, organization deletion, plan change, referral creation, and sign-out workflows;
- shared destructive-impact check presentation;
- concrete service/handoff destination metadata for leaves;
- progressive availability where navigation remains usable but production execution remains disabled until its service is connected;
- preservation of the underlying Exchange state because Menu remains an overlay.

The reference member and organization values remain deterministic chassis context only. Production authenticated viewer context, role/permission evaluation, notification counts, billing truth, workflow persistence, and final mutations must come from server-backed application services.
