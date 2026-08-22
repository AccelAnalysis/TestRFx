# Capabilities — reconciled deep workflows

Capabilities remains one of the four Exchange lenses. This reconciliation restores the source-defined child/grandchild workflow hierarchy without replacing the map, search, drawer, shared card, detail-controller, bottom navigation, Menu, or organization-media systems.

## Canonical truth

Organization capability truth is owned by the existing PostgreSQL onboarding model:

- `organization_capability_claims`
- `organization_capability_evidence`
- `organization_capability_profiles`
- immutable/versioned `amacs_runtime_*` release tables

The `capabilities` table is an Exchange publication projection only. `db/capabilities-runtime.sql` adds publication state; it does not create another claims/evidence repository.

## Source hierarchy

```text
Open Capabilities Lens
├── Own Organization View
│   └── View current capability profile
│       └── Manage Capabilities
│           └── AI → AMACS Mapping
│               └── Add / Edit Evidence
│                   └── Identify Capability Gaps
│                       └── Save / Publish updates
│                           └── Capability profile available in Exchange
└── Other Organization View
    └── Browse / search organizations
        └── View Capabilities
            └── Match to RFx / requirement
                └── Decide next action
                    ├── Refer
                    │   └── Cross-lens referral workflow
                    ├── Save / Follow
                    │   └── Watchlist / saved organizations
                    └── Open detail
                        └── Capability detail / supporting evidence
```

## AMACS

AMACS is a governed, versioned standard. Candidate interpretation is non-authoritative until an authorized organization participant accepts a mapping. Manual search remains available when an interpretation provider is not configured. The active RFxchange Identity/organization session is the actor authority for both manual and assisted mapping workflows.

## Matching

The shared Exchange Match action now has a governed capability-to-RFx provider. It compares accepted AMACS concepts to structured `rfx_requirements.metadata` identifiers. Requirements without a structured AMACS identifier are marked `uncertain`; RFxchange does not infer eligibility, document, or capability fit from free text. Match decisions are persisted in the canonical `match_decisions` provenance table.

## Shared workflows

Capabilities reuses the shared services established by Resources:

- Save / Follow → `record_relationships`
- Refer → `referrals` + `referral_events`
- referral policy / fee disclosure → `referral_policies`
- Match provenance → `match_decisions`

No Capabilities-specific session, relationship, referral, or match repository is introduced.

## Identity authority

Capability Enrichment and AMACS interpretation no longer trust `x-rfxchange-user-id` as actor authority. They resolve the current RFxchange Identity/active-organization session and reject organization mismatch.

## Organization media

Capability cards continue to consume the organization logo/intro-media projection introduced by the current Menu + Organization Media system. This reconciliation does not replace or fork those media contracts.
