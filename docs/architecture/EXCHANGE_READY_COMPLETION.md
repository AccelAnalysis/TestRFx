# Identity & Onboarding — Exchange-ready Completion

## Purpose

Exchange-ready Completion is the final controlled handoff from the Identity & Onboarding shell into the authenticated RFxchange operating chassis. It is **not** a second home page and it is **not** a requirement that every possible organization-profile field be complete.

The source onboarding flow defines two distinct outcomes:

1. **Review & Completion Checkpoint** — check required and recommended items, highlight missing items with actionable prompts, show a profile-completeness indicator, and allow the participant to save and continue later.
2. **Exchange Ready** — the organization has a listed/present Exchange state, can browse RFx, Resources, Intelligence, and Capabilities, and can continue managing its profile through authenticated utilities.

The same source explicitly says onboarding is progressive: a participant can reach the Exchange and continue to enrich the organization and capabilities profile over time.

## Operating-chassis rule

This module terminates in the existing authenticated Exchange shell. It does not recreate or import lens business logic.

```text
Identity & Onboarding
        │
        ├── Account verification
        ├── Organization selection / creation
        ├── Geography
        ├── Organization profile
        ├── Capability enrichment
        │
        ▼
Exchange-ready Completion
        │
        ├── readiness evaluation
        ├── review / remediation
        ├── activation transaction
        │
        ▼
Authenticated Exchange Shell
        │
        ├── Persistent Map
        ├── Universal Search
        ├── Sliding Result Drawer
        ├── RFx
        ├── Resources
        ├── Intelligence
        ├── Capabilities
        └── Menu
```

The authenticated shell remains governed by `lib/exchange/contracts.ts` and the four existing `ExchangeLens` values. Exchange-ready Completion does not add a Home lens, an Onboarding lens, or a Profile lens.

## Readiness versus profile completeness

Two concepts are intentionally separate.

### Exchange readiness

Exchange readiness answers:

> Does RFxchange have enough valid identity, organization, geography, capability, visibility, and participation-access state to allow this organization to operate in the Exchange?

Required items may block activation.

### Profile completeness

Profile completeness answers:

> How fully enriched is the organization and capability profile for discovery, matching, trust, and future workflows?

Recommended and optional enrichment normally does **not** block entry.

A production organization can therefore be Exchange-ready while still having recommended AMACS alignment, evidence, certifications, keywords, specialties, or other enrichment remaining.

## Readiness classifications

`lib/onboarding/readiness.ts` defines three classifications.

### Required

The reference contract includes:

- verified account / identity;
- established organization;
- confirmed user-to-organization affiliation;
- established operating geography;
- initialized capability profile;
- explicit Exchange visibility state;
- resolved participation entitlement.

Production adapters can refine the individual checks, but a server-side evaluator must remain authoritative.

### Recommended

The reference contract treats deeper AMACS alignment and evidence/certifications as recommended enrichment. These improve quality and trust but do not keep an otherwise-valid organization outside the Exchange.

### Optional

Keywords and specialties are represented as optional enrichment in the reference implementation. Additional evidence, locations, service areas, media, contacts, and richer capability metadata can follow the same pattern.

## Membership / entitlement rule

The Registration source depicts an active membership as an outcome and a paid Founding Membership path. RFxchange project architecture also distinguishes free and paid participation paths.

For that reason, Exchange-ready Completion does **not** hard-code “Stripe payment succeeded” as a universal requirement. The readiness contract instead requires:

> The selected participation path has a valid entitlement state.

A production entitlement adapter can therefore resolve free access, Founding Membership, future plans, invitations, trials, or other governed access models without changing the completion UI.

## Geography and map presence

The Registration source treats “map marker placed” and “Your marker is live” as important onboarding outcomes. The Exchange chassis, however, deliberately supports valid records without coordinates.

The completion contract therefore distinguishes:

```text
Geography established
        │
        ├── Public mappable presence
        │       └── marker_ready
        │
        └── No public point location
                └── off_map
```

A production organization should not be forced to expose or invent a public street location merely to become Exchange-ready. Service geography, locality, or other governed geographic context can support an off-map presence while the record remains discoverable in result surfaces.

## Route

The bounded UI lives at:

```text
/onboarding/completion
```

An upstream Identity/Onboarding flow may optionally provide a safe authenticated Exchange destination:

```text
/onboarding/completion?returnTo=/exchange/capabilities
```

`resolveExchangeDestination()` allow-lists only routes inside the existing Exchange lens structure. Unsafe, external, or unsupported destinations fall back to `/exchange`.

The default `/exchange` destination preserves the current operating-chassis entry behavior instead of inventing a new onboarding-specific destination.

## API boundary

### `GET /api/onboarding/readiness`

Returns the normalized readiness snapshot used by the reference UI.

Current mode is deterministic and intentionally infrastructure-free.

Production should replace the reference evaluator with adapters backed by authenticated session/identity, organization membership, organization profile, geography, capability, visibility, membership/entitlement, and policy repositories.

### `POST /api/onboarding/readiness/activate`

Represents the Exchange activation transaction.

The reference implementation:

1. re-evaluates readiness server-side;
2. rejects activation if blocking items remain;
3. sanitizes the requested Exchange destination;
4. returns an activation result and the platform events a durable production transaction should emit.

The reference API does **not** claim durable publication, indexing, payment reconciliation, or audit persistence.

## Production activation transaction

A durable implementation should perform a transaction/workflow equivalent to:

```text
Enter the Exchange
        │
        ▼
Revalidate authenticated readiness
        │
        ▼
Resolve organization role + permission context
        │
        ▼
Resolve participation entitlement
        │
        ▼
Confirm geography + visibility preferences
        │
        ▼
Publish / activate organization Exchange presence
        │
        ├── marker-ready presence
        └── off-map presence
        │
        ▼
Initialize / publish capability projection
        │
        ▼
Queue search + matching + geospatial indexing
        │
        ▼
Write activity / audit events
        │
        ▼
Return authenticated Exchange destination
```

The client must never treat “the user visited all onboarding screens” as sufficient proof of readiness.

## Events

The reference activation response identifies the event vocabulary expected at the platform boundary:

- `OnboardingReadinessEvaluated`
- `OrganizationExchangeReady`
- `OrganizationPublished`
- `ExchangeAccessEnabled`
- `OrganizationMarkerActivated` or `OrganizationOffMapPresenceActivated`
- `CapabilityProfileInitialized`
- `OnboardingCompleted`

Production can add durable event identifiers, actor/organization context, trace IDs, and downstream processing metadata.

## First Exchange entry

Completion should open the already-existing authenticated Exchange rather than an onboarding-only dashboard.

The current chassis default is `/exchange`, which initializes the RFx lens. A safe `returnTo` can instead restore a permitted Exchange lens or record destination when the participant originally arrived from a campaign, invitation, protected deep link, or another acquisition path.

The Exchange shell continues to own:

- persistent map state;
- search;
- drawer mechanics;
- governed lens actions;
- record cards;
- detail surfaces;
- bottom lens navigation;
- Menu and cross-lens utilities.

## Progressive enrichment after entry

After activation, remaining enrichment should be described as profile/capability improvement rather than “unfinished registration.”

Primary post-entry surfaces are expected to include:

```text
Capabilities → Own Organization
    ├── Manage capabilities
    ├── Map / review AMACS alignment
    ├── Add evidence
    └── Publish updates

Menu → Organization Profile
    ├── Organization details
    ├── Locations / geography
    ├── Visibility
    ├── Membership / billing
    └── Settings
```

Those downstream workflows plug into the operating chassis and remain outside this module.

## Returning / invited users

Readiness is organization-context-aware, not a one-time new-user wizard flag.

An invited user joining an organization that is already Exchange-ready may only need identity verification, invitation acceptance, and role establishment. The completion evaluator should reuse existing organization, geography, capability, visibility, and entitlement state rather than forcing the user to recreate it.

Likewise, a returning user's organization can become temporarily non-ready if a truly blocking production condition changes. The server evaluator, not client history, determines the current truth.

## Reference implementation boundary

This PR deliberately uses deterministic data matching the existing TestRFx reference organization (`Your Organization`, Isle of Wight, VA) so the completion UX can be exercised without production credentials or persistence.

It does **not** claim production completion for:

- authentication/session verification;
- organization claim or invitation approval;
- persistent onboarding progress;
- geocoding or real map publication;
- Stripe checkout/payment state;
- free/paid entitlement repositories;
- AMACS production taxonomy services;
- capability evidence persistence;
- search/index publication;
- notification delivery;
- audit/event persistence.

Those systems replace the reference adapters behind the readiness/activation boundary. They should not require redesigning the completion checkpoint or the authenticated Exchange chassis.

## Parallel-work integration

This slice is intentionally additive because other Public and Identity/Onboarding modules are being built in parallel. It does not rewrite the shared `/onboarding` placeholder or adjacent step routes.

The upstream contract is simple:

```text
Previous onboarding step
        │
        └── navigate to /onboarding/completion
              └── preserve a safe returnTo when one exists
```

Once the parallel onboarding slices converge, their final step should terminate here rather than linking directly to `/exchange`.
