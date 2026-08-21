# Capabilities Lens

## Scope

This module builds **Authenticated Exchange Shell → Bottom Navigation → Capabilities** as a domain lens that plugs into the RFxchange operating chassis. It does not create a second application, a second map, a second navigation system, or a capability-only organization database.

The permanent shell remains responsible for the map, universal search, floating controls, three-state result drawer, four-slot lens-control rail, shared record-card framework, shared detail controller, bottom navigation, deep links, selection state, and responsive behavior.

Capabilities supplies the domain projection placed into those contracts.

## Product question

The Capabilities lens answers two related questions:

- **Discovery:** who can do what, where, with what supporting evidence, and how does that capability relate to a requirement?
- **Own organization management:** what can my organization credibly do, how is it mapped to AMACS, what supports the claim, what remains incomplete, and where are the gaps?

The discovery result object is an **organization capability profile**, not a naked taxonomy node. The signed-in organization's management state is separate from ordinary discovery ranking.

## Organization-centered projection

`lib/capabilities/reference.ts` models multiple capability claims under one organization and projects each discoverable organization back into the existing `ExchangeRecord` contract.

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
        ├── internal profile completeness
        ├── capability gaps
        └── RFx match context
                 │
          ┌──────┴─────────┐
          ▼                ▼
   discovery projection   own-org management
   (published context)    (completion/gaps)
```

This allows search, map selection, cards, drawer behavior, deep links, and the detail controller to remain chassis-owned while keeping internal management metrics out of discovery presentation.

## Lens controls versus record actions

The four permanent controls above the drawer are lens-wide and do not change when a capability card is selected.

For an authorized capability manager the current rail is:

1. **My Capabilities**
2. **Manage**
3. **Following**
4. **All**

For other viewers it resolves to discovery-oriented controls such as Following / Mapped / Off-map / All.

Record-specific actions remain on cards and in detail:

### Own organization record

- Manage
- AI → AMACS
- Evidence
- Gaps in detail

### Other organization record

- Match RFx
- Refer
- Share

Production authorization must derive ownership and permissions from authenticated user / active-organization membership context. `ownedByViewer` is deterministic reference state in TestRFx.

## Capability card

Capabilities uses the shared `RecordCard` framework with a capability adapter. A discovery card may show:

- organization identity;
- geography/service area;
- lead capability and limited capability classifications;
- relevant AMACS/evidence/publication context when useful;
- save/follow state;
- contextual record actions.

A capability discovery card does **not** display profile-completeness/profile-strength percentages. Those numbers describe internal profile-management progress and can be confused with qualification, verification, or match strength. They remain available to onboarding and own-organization management workflows only.

Likewise, ownership is conveyed through the shared visual self treatment rather than repeated text such as `Your Organization`, `Owned by you`, or `Your capability profile`.

Records without a public location remain valid drawer results and simply do not render map markers.

## Self organization and empty capability state

The signed-in organization is persistent Exchange context, but it is not automatically inserted into ordinary capability discovery merely because the viewer owns it.

- If the organization has published/discoverable capabilities, those real capability records can appear in discovery when relevant.
- If it has no published capabilities, ordinary discovery does not receive a synthetic placeholder result and its result count is not inflated.
- The organization can still remain visible as the Exchange's self map anchor.
- **My Capabilities** / **Manage** remain the route into the organization's management surface, including an empty or incomplete profile. That management state may show profile completeness and specific next actions.

## Capability detail

The shared `DetailSurface` delegates capability records to a capability-specific body while preserving the shared overlay controller and return behavior.

Capability detail exposes published/discovery-relevant information such as organization summary, capability claims, AMACS mapping state, supporting evidence labels, service geography, discoverability terms, and truth boundaries. Internal profile-completeness percentages are not required for another participant to evaluate a discovery result.

Returning closes the overlay rather than replacing the Exchange with another page.

## Workflow surfaces

### Manage Capabilities

Reviews the signed-in organization's capability inventory, publication state, mapping state, evidence coverage, profile completeness, and remaining work. This is the appropriate home for internal completeness metrics and next-step guidance.

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

Shows licenses, certifications, case studies, past performance, documents, and links associated with capability claims. Evidence supports a claim; evidence upload does **not** automatically mean RFxchange independently verified the capability.

### Capability Gaps

Surfaces both profile-quality gaps and requirement gaps. The intended handoff is back into Exchange discovery with the gap context preserved so the user can find a complementary organization.

### Match to RFx

Demonstrates requirement-aware match context. Production matching should compare RFx requirement capabilities against organization capabilities through AMACS / semantic alignment and return aligned, partial, missing, and uncertain requirements rather than only a context-free percentage.

### Refer

Demonstrates a Capabilities → Referral handoff. The shared referral engine owns creation, terms, status, audit, and any monetary workflow. Menu owns ongoing referral management.

## Search

The shared Universal Search changes semantic context through the lens definition:

> Search companies, capabilities, AMACS categories…

The discovery adapter indexes organization name, capability names, AMACS IDs/labels, specialties, service areas, geography, and discoverability terms. Internal profile-completeness percentages are not discovery search terms.

Production search remains an Exchange Search service concern rather than a Capabilities-only search implementation.

## Onboarding convergence

Onboarding and the authenticated lens intentionally use compatible truth concepts: plain-language claims; suggested/accepted/needs-review mapping states; evidence as support rather than automatic verification; draft/ready/published visibility; specialties/discoverability terms; profile-completion guidance; and gap review.

The intended flow is:

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
(published context)   (completion work)
```

## Production service boundaries

Production integrations still include authenticated active-organization resolution, server-side capability authorization, canonical persistence, live AMACS/AI mapping, verification, evidence object storage, Exchange search, RFx matching, referrals, persistent follows, notifications, and audit/activity persistence. They replace the deterministic adapters behind the same chassis contracts.

## Acceptance behaviors

A configured-browser acceptance run should verify:

1. `/exchange/capabilities` keeps the persistent Exchange map/search/drawer/bottom navigation mounted.
2. The drawer counts actual capability discovery records, not a synthetic self-organization placeholder.
3. Located capability organizations render markers; off-map capability records remain valid drawer results.
4. The signed-in organization retains a visual self treatment without `Your Organization` / `Owned by you` text.
5. Profile-completeness percentages do not appear on discovery cards or in discovery metadata.
6. My Capabilities / Manage can still open own-organization management, where completeness and next actions are appropriate.
7. Marker selection scrolls matching real records into view; the self anchor does not fabricate a selected result.
8. Other organizations expose Match RFx / Refer / Share record actions.
9. Capability detail opens inside the shared detail controller and returns to prior Exchange state.
10. Search matches organization/capability/AMACS/specialty/service-area terms without treating profile completeness as discovery relevance.
