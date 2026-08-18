# Identity & Onboarding — Exchange-ready Completion

## Purpose

Exchange-ready Completion is the controlled handoff from the Identity & Onboarding shell into the existing authenticated RFxchange operating chassis. It implements the source-defined **Review & Completion Checkpoint** and **Exchange Ready** outcomes without introducing another application shell or another Exchange lens.

The governing distinction is:

- **Exchange readiness** answers whether required identity, organization, geography, profile, capability, visibility, and participation state is complete enough to activate the handoff.
- **Profile completeness** measures progressive enrichment. AMACS depth, evidence, certifications, keywords, and specialties can continue after entry.

Visiting onboarding screens is never sufficient proof of readiness.

## Hierarchical workflow

The route tree is explicit and navigable:

```text
Identity & Onboarding
│
├── Account Verification
│   └── Verify email / access
│
├── Organization Selection / Creation
│   ├── Select / claim / join / create
│   └── Confirm affiliation / authority
│
├── Geography
│   ├── Primary locality
│   ├── Base location / map treatment
│   ├── Privacy preference
│   └── Service geography
│
├── Organization Profile
│   ├── Core profile details
│   ├── Industry & services
│   └── Visibility preferences
│
├── Capability Enrichment
│   ├── Capabilities entry
│   ├── AMACS mapping / assistance
│   ├── Evidence / certifications
│   └── Tags / keywords / specialties
│
├── Participation / Membership
│   ├── Free organization participation
│   └── Founding Membership
│
└── Exchange-ready Completion
    ├── Review & completion checkpoint
    ├── Confirm Exchange presence
    └── Exchange-ready confirmation
        ├── Browse RFx
        ├── Browse Resources
        ├── Browse Intelligence
        ├── Browse Capabilities
        └── Manage profile through Menu
```

The source-defined capability-enrichment children are addressable using `?stage=` routes under `/onboarding/capabilities`. Completion itself has concrete `/onboarding/completion`, `/onboarding/completion/activate`, and `/onboarding/completion/success` routes.

## Progress service

`lib/onboarding/progress.ts`, `lib/onboarding/progress-store.ts`, and `/api/onboarding/progress` define the shared completion-state contract.

Current TestRFx persistence uses one HttpOnly, SameSite=Lax onboarding-progress cookie. It is application workflow state, not an authentication credential and not an authorization source. Production authenticated authorization remains a separate server responsibility.

The workflows that own a readiness condition write that condition themselves:

- successful account verification writes `account_verified`;
- organization resolution writes `organization_established` and the current affiliation state;
- validated geography writes `geography` and the current map/off-map state;
- validated Organization Profile writes `organization_profile` and `visibility`;
- capability completion writes `capability_profile` plus AMACS/evidence/keyword enrichment status;
- participation selection writes `entitlement`.

`GET /api/onboarding/readiness` derives the normalized readiness snapshot from that saved state. It no longer returns an all-green deterministic fixture.

## Readiness classifications

Required checkpoints are blocking:

- account verified;
- organization established;
- organization affiliation active;
- geography established;
- organization profile complete;
- capability profile initialized;
- visibility selected;
- participation entitlement resolved.

Recommended/optional enrichment is non-blocking:

- AMACS alignment;
- evidence/certifications;
- keywords/specialties.

Missing required items expose direct links to the workflow that owns the state rather than displaying passive warnings.

## Organization affiliation

Creating an organization can establish an active creator membership in the current onboarding flow. Claiming or requesting access to an existing organization can remain pending.

Completion does not simulate administrator approval or authority resolution. A pending membership or authority state stays `needs_attention` and blocks activation until a real upstream workflow marks it active.

## Geography and map truth

The previous Geography implementation drew a simulated marker even though no production geocoder was connected. That workflow has been removed.

The active flow now records:

- primary locality;
- base address;
- current map treatment;
- privacy preference;
- service geography.

Without a real coordinate, the organization is `off_map`. Completion and Step 10 never claim that a marker exists merely because a user supplied an address. A future geocoder/map service can promote the organization to `marker_ready` only after a real coordinate exists and publication policy allows it.

This preserves the chassis rule that valid Exchange records may appear in result surfaces without a map marker.

## Capability truth

Capability Enrichment no longer uses deterministic example capability suggestions, canned discoverability terms, fabricated AMACS matches, or fake evidence attachments.

The operational workflow now supports:

- user-entered capability names and descriptions;
- optional manually entered AMACS node ID/label, explicitly treated as organization-confirmed rather than independently verified;
- evidence metadata entered by the user;
- user-entered specialties / keywords;
- draft versus ready publication intent;
- server-side capability readiness save before Completion.

If an AMACS service or object-storage service is not connected, the UI says so rather than fabricating their output.

## Participation / membership

Commercial membership and Exchange readiness remain separate concepts.

The current operational paths are:

- **Free organization participation** — can be activated now and satisfies the participation-entitlement checkpoint.
- **Founding Membership** — requires genuine Stripe checkout and verified payment confirmation. If Stripe checkout is unavailable, RFxchange does not simulate payment or paid entitlement. The user can continue with Free participation and return later.

Payment never implies capability verification, organization authority, or trust status.

## Activation workflow

`/onboarding/completion/activate` displays the exact organization/geography/visibility/map/participation state being activated.

`POST /api/onboarding/readiness/activate` then:

1. reads the saved onboarding progress;
2. recalculates readiness server-side;
3. rejects activation while blocking checkpoints remain;
4. sanitizes the requested Exchange destination;
5. records the Exchange-ready activation state;
6. sends the participant to `/onboarding/completion/success`.

No fake indexing, notification, publication, or event-bus work is reported as complete.

## Exchange-ready success

`/onboarding/completion/success` is Step 10. It only displays success when activation was actually recorded.

It exposes the source-defined post-completion destinations:

- RFx;
- Resources;
- Intelligence;
- Capabilities;
- Menu / organization profile.

It also preserves a safe requested Exchange destination. `resolveExchangeDestination()` restricts handoff targets to the existing Exchange route/lens structure.

## Progressive enrichment after entry

After activation, optional capability work is described as continued enrichment rather than unfinished registration. Users can return to AMACS, evidence, and discoverability stages or manage the same organization through authenticated Capabilities/Menu surfaces.

## Security boundary

The onboarding progress cookie is deliberately not an authorization mechanism. The authenticated Exchange must independently enforce session, organization membership, role/permission, account restriction, and any commercial entitlement policy on the server.

Completion therefore answers **onboarding readiness**, not **authorization to bypass protected Exchange controls**.

## Remaining external integrations

This module does not fabricate services that are not actually connected. Real implementations are still required for capabilities that depend on external infrastructure, including:

- production identity/session authorization;
- organization administrator approval for pending access/claims;
- authoritative geocoding and real map coordinates;
- Stripe checkout/payment confirmation for Founding Membership;
- authoritative AMACS taxonomy lookup/inference;
- object storage for evidence files;
- durable server database persistence if/when the TestRFx runtime is moved beyond the current progress store.

Until those services exist, the corresponding workflow remains unavailable, pending, off-map, or progressively incomplete rather than mocked.
