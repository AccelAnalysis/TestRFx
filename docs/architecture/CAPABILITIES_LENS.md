# Capabilities Lens

## Scope

This module builds **Authenticated Exchange Shell → Bottom Navigation → Capabilities** as a domain lens that plugs into the RFxchange operating chassis. It does not create a second application, a second map, a second navigation system, or a capability-only organization database.

The permanent shell remains responsible for the map, universal search, floating controls, three-state result drawer, four-slot action rail, shared record-card framework, shared detail controller, bottom navigation, deep links, selection state, and responsive behavior.

Capabilities supplies the domain projection placed into those contracts.

## Product question

The Capabilities lens answers two related questions:

- **Discovery:** who can do what, where, with what supporting evidence, and how does that capability relate to a requirement?
- **Own organization:** what can my organization credibly do, how is it mapped to AMACS, what supports the claim, and where are the gaps?

The primary result object is therefore an **organization capability profile**, not a naked taxonomy node.

## Organization-centered projection

`lib/capabilities/reference.ts` models multiple capability claims under one organization and projects each organization back into the existing `ExchangeRecord` contract.

```text
Organization Capability Profile
        │
        ├── capability claims
        │     ├── plain-language description
        │     ├── AMACS mapping
        │     ├── mapping state
        │     ├── publication state
        │     ├── evidence state
        │     ├── evidence
        │     └── specialties
        │
        ├── service geography
        ├── discoverability terms
        ├── profile strength
        ├── capability gaps
        └── RFx match context
                 │
                 ▼
          ExchangeRecord adapter
                 │
                 ▼
        Shared Exchange chassis
```

This allows search, map selection, cards, drawer behavior, deep links, and the detail controller to remain chassis-owned.

## Own organization vs. other organization

Ownership changes the meaning of the four governed action positions.

### Own organization

1. **Manage Capabilities**
2. **AI → AMACS**
3. **Add / Edit Evidence**
4. **Capability Gaps**

### Other organization

1. **View Capabilities**
2. **Match to RFx**
3. **Refer**
4. **Save / Follow**

The positions remain fixed. Capabilities supplies the action definitions and the shell dispatches them.

Production authorization must derive ownership and permissions from authenticated user / organization membership context. `ownedByViewer` is still deterministic reference state on this chassis branch.

## Capability card

Capabilities uses the shared `RecordCard` framework with a capability adapter. The card is organization-led and shows:

- organization identity;
- geography;
- lead capability;
- up to three capability claims;
- accepted AMACS mapping coverage;
- evidence count;
- profile strength;
- own-organization context;
- save state.

Records without a public location remain valid drawer results and simply do not render map markers.

## Capability detail

The shared `DetailSurface` delegates capability records to a capability-specific body while preserving the shared overlay controller and return behavior.

Capability detail exposes:

- organization summary;
- governed action rail;
- capability claims;
- AMACS mapping state;
- supporting evidence labels;
- service geography;
- discoverability terms;
- reference-data truth boundary.

Returning closes the overlay rather than replacing the Exchange with another page.

## Workflow surfaces

The reference implementation makes each substantive Capabilities action demonstrable without claiming production persistence.

### Manage Capabilities

Reviews the organization capability inventory, publication state, mapping state, and evidence coverage. Production add/edit/archive/publish commands belong behind server authorization and the canonical capability repository.

### AI → AMACS

Shows structured AMACS mappings attached to capability claims. The governing truth rule is:

```text
plain-language claim
      ↓
AI / taxonomy candidate
      ↓
user review
      ↓
accept / edit / reject
      ↓
organization-asserted mapping
```

An AI suggestion must not silently become accepted organization truth.

### Add / Edit Evidence

Shows licenses, certifications, case studies, past performance, documents, and links associated with capability claims.

Evidence supports a claim. Evidence upload does **not** automatically mean RFxchange independently verified the capability.

Production evidence requires object storage, metadata persistence, authorization, visibility controls, and audit events.

### Capability Gaps

Surfaces both profile-quality gaps and requirement gaps. The intended handoff is back into Exchange discovery with the gap context preserved so the user can find a complementary organization.

### Match to RFx

Demonstrates requirement-aware match context. Production matching should compare RFx requirement capabilities against organization capabilities through AMACS / semantic alignment and return aligned, partial, missing, and uncertain requirements rather than only a context-free percentage.

### Refer

Demonstrates a Capabilities → Referral handoff. The shared referral engine owns creation, terms, status, audit, and any monetary workflow. Menu owns ongoing referral management. Referrals do not become another bottom-navigation lens.

### Save / Follow

The shell now owns in-memory save state so cards and the Capabilities action rail stay synchronized while the user changes records or lenses. Production persistence plugs into the shared Favorites / relationships service.

## Search

The shared Universal Search changes semantic context through the lens definition:

> Search companies, capabilities, or AMACS…

The deterministic adapter indexes organization name, capability names, AMACS IDs / labels, specialties, service areas, geography, and discoverability terms through the normalized Exchange record metadata.

Production search remains an Exchange Search service concern rather than a Capabilities-only search implementation.

## Onboarding convergence

The unmerged Capability Enrichment module and this authenticated lens intentionally use compatible truth concepts:

- plain-language capability claims;
- `suggested`, `accepted`, and `needs-review` AMACS mapping states;
- evidence as support rather than automatic verification;
- draft / ready / published visibility intent;
- specialties / discoverability terms;
- gap review.

When onboarding persistence is merged, the target flow is:

```text
Identity / Onboarding Capability Enrichment
              │
              ▼
canonical organization capabilities
              │
      ┌───────┴────────┐
      ▼                ▼
Exchange capability   Own-org management
search projection     in Capabilities lens
```

The two modules should converge behind a shared repository / service rather than copy browser-session onboarding state into Exchange UI code.

## Production service boundaries

This branch does not claim production completion for:

- authentication or active-organization resolution;
- server-side capability authorization;
- canonical capability persistence;
- live AMACS taxonomy / AI mapping;
- independent capability verification;
- object storage for evidence;
- production Exchange search;
- RFx requirement repositories or match scoring;
- referral creation / terms / payouts;
- persistent follows / favorites;
- notifications;
- activity / audit persistence.

Those systems replace the deterministic adapters behind the same chassis and Capabilities contracts.

## Acceptance behaviors

A configured-browser acceptance run should verify:

1. `/exchange/capabilities` keeps the persistent Exchange map/search/drawer/bottom navigation mounted.
2. The drawer reports organizations rather than generic capability-result counts.
3. Located capability organizations render markers; the Regional Working Dog Institute remains a valid off-map drawer result.
4. Marker selection scrolls the matching organization card into view.
5. Own organization exposes Manage Capabilities / AI → AMACS / Add / Edit Evidence / Capability Gaps.
6. Other organizations expose View Capabilities / Match to RFx / Refer / Save / Follow.
7. Capability cards show organization-led capability, AMACS, evidence, and profile-strength context.
8. Capability detail opens inside the shared detail controller and returns to prior Exchange state.
9. Own-organization workflow actions open their reference workflow surfaces without navigating away from the shell.
10. Match to RFx and Refer open cross-domain handoff surfaces without creating new bottom-navigation destinations.
11. Save / Follow changes save state immediately and the action label updates to Saved.
12. Search matches organization names, capability terms, AMACS reference terms, specialties, service areas, and keywords.
