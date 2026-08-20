# Capabilities — deep hierarchy and service integration

This module implements the source-defined **Authenticated Exchange Shell → Bottom Navigation → Capabilities** hierarchy without turning Capabilities into a separate application. The persistent Exchange still owns map, universal search, drawer, cards, detail, four-slot actions, bottom navigation, and cross-lens state.

## Source hierarchy

No additional child menu nodes are introduced beyond the Capabilities source flow.

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

The source's shared outcomes remain outcomes, not invented navigation destinations:

- Capability visibility in Exchange
- Requirement-to-capability matching
- Teaming / referral opportunities
- Capability intelligence inputs

## Nested navigation state

`lib/capabilities/navigation.ts` is the canonical Capabilities tree. The workflow surface renders that tree recursively and stores the active child/grandchild in the `capNode` URL query parameter. Browser Back/Forward therefore restores nested workflow state while the underlying Exchange lens remains mounted.

The four permanent action slots remain unchanged as shell positions. They enter the hierarchy at the appropriate source-defined nodes; they do not replace the hierarchy.

## Service replacements

### Capability repository

`app/api/capabilities` is now the application boundary for capability reads and mutations. The Node runtime uses `lib/capabilities/repository.ts`, which persists profiles under `RFXCHANGE_DATA_DIR` (default `.rfxchange-data`) with atomic file replacement rather than component/session-only state.

Supported commands:

- add capability claim
- update capability claim
- accept/edit/reject AMACS mapping
- add/remove evidence metadata
- save profile
- publish eligible claims

Mutations are restricted to the profile marked as the active viewer organization by the current chassis identity boundary. Production authentication/authorization can replace that resolver without changing the UI or command contract.

`db/capabilities-workflows.sql` defines the normalized PostgreSQL target for multiple organization capability claims, evidence, publication state, and AMACS participant decisions.

### AMACS

AMACS is treated according to its real authority model: a governed versioned standard, not an AI provider. `lib/capabilities/amacs.ts` can read a configured AMACS release artifact through `AMACS_CATALOG_URL`, rank lexical candidates, and return non-authoritative interpretation candidates. The participant must accept, edit, or reject a mapping. When no release artifact is configured, the manual mapping path remains available instead of fabricating suggestions.

The adapter identifies the runtime contract as AMACS 0.5.0. Automated candidate generation is deliberately provider-neutral and cannot silently create authoritative organization assertions.

### RFx matching

`lib/capabilities/matching.ts` computes organization-to-RFx alignment from the structured requirements in `lib/rfx/catalog.ts`. It reports requirement-level `aligned`, `partial`, `missing`, or `uncertain` states. Non-capability requirements such as documentation or eligibility stay uncertain instead of being inferred from capability text.

This replaces static `profile.rfxMatches` as the workflow decision source.

### Follow / Saved

The shared workflow API now persists relationship records through `lib/exchange/workflow-repository.ts`. `Save / Follow` calls the real shared workflow boundary, then the `Watchlist / saved organizations` child reads the persisted relationship collection from that same service.

### Referral

`Refer` creates a durable referral record through the shared workflow API. The `Cross-lens referral workflow` child reads the persisted referral collection rather than presenting a placeholder handoff message.

## Evidence boundary

The implemented service persists evidence metadata and provenance. Large uploaded binaries still belong in the platform object-storage service; `db/capabilities-workflows.sql` already reserves `object_key` / `source_url` fields for that adapter. Evidence support remains distinct from independent verification.

## Static Pages preview

The GitHub Pages layer is intentionally a static projection and strips runtime API routes during its preview build. Real service mutations therefore require the server-capable Next.js runtime. The preview may still demonstrate the shell and source hierarchy, but it must not pretend static browser state is durable server persistence.

## Remaining platform-owned boundaries

This slice does not recreate platform-wide services that belong outside Capabilities: production session identity, PostgreSQL deployment/configuration, object-storage binaries, notifications, billing/referral settlement, or independent verification. The Capabilities UI now calls explicit service contracts so those implementations can replace adapters without another information-architecture rewrite.
