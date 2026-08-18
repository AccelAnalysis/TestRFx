# Identity & Onboarding → Capability Enrichment

Capability Enrichment is the RFxchange onboarding module that initializes and improves an organization's structured capability identity before the Exchange-ready checkpoint. It is **not** a second Capabilities application.

The operating rule is:

```text
Organization Profile
        │
        ▼
Capability Enrichment
        │
        ├── human-language capability claims
        ├── AMACS mapping candidates
        ├── evidence relationships
        ├── discoverability terminology
        ├── quality / gap review
        └── publication intent
        │
        ▼
Exchange-ready completion
        │
        ▼
Authenticated Capabilities lens
```

The same canonical organization and capability records should flow through the entire sequence.

## Responsibilities

The module owns the onboarding interaction for:

1. hydrating known organization context instead of asking users to re-enter it;
2. capturing capability claims through suggestions or plain language;
3. presenting AMACS mapping candidates and recording user confirmation / review intent;
4. associating evidence with the capability claim it supports;
5. collecting specialties and alternate search terminology without treating them as taxonomy truth;
6. surfacing enrichment gaps and profile-strength guidance;
7. recording draft / ready / published intent for the next onboarding checkpoint;
8. preserving in-progress state so users can leave and continue later.

The module does **not** own:

- account or organization verification;
- canonical organization profile persistence;
- production AI inference;
- AMACS taxonomy governance;
- external verification of capability claims;
- authorization decisions;
- file/object storage;
- Exchange activation;
- authenticated Capabilities lens mechanics.

## Truth and provenance model

The user must not need to understand AMACS before entering a capability. The intended flow is:

```text
Human description
      │
      ▼
Capability claim
      │
      ▼
AMACS candidate mapping
      │
      ├── suggested
      ├── accepted by organization user
      └── needs review
```

Inference is not verification. Production implementation should preserve provenance for at least:

- `suggested-from-profile`;
- `entered-by-user`;
- future AI/inference source metadata;
- user confirmation;
- future governed verification.

A capability can therefore be user-confirmed and evidence-supported without RFxchange claiming that an external verification process has occurred.

## Evidence boundary

Evidence belongs to capability claims rather than to a generic onboarding form. Production evidence should use the shared object-storage service, while canonical relational data stores:

- organization / capability ownership;
- evidence type and metadata;
- object key or external link;
- relationship to one or more capability claims;
- permissions / visibility;
- provenance and audit history.

The current reference UI uses deterministic attachment placeholders only to prove this interaction contract.

## Discoverability boundary

Keywords, specialties, technologies, alternate language, and search synonyms improve Exchange retrieval and matching. They do not automatically become AMACS nodes.

Production search can index these terms alongside canonical capability data while keeping structured taxonomy alignment separate.

## Profile-strength behavior

Profile-strength guidance is advisory. It may consider:

- number of capability claims;
- confirmed AMACS mappings;
- evidence-supported claims;
- discoverability terms;
- incomplete or duplicate claims.

Optional enrichment should not become an arbitrary blocker to Exchange activation. The separate Exchange-ready completion module owns readiness policy.

## Persistence contract

The reference UI persists an in-progress `CapabilityEnrichmentSnapshot` in browser session storage so the UX can be exercised independently. Production should replace that adapter with authenticated server persistence without changing the workflow contract.

Conceptually:

```text
Capability Enrichment UI
        │
        ▼
Capability application service
        │
        ├── organization context service
        ├── AMACS projection / mapping service
        ├── evidence service
        ├── authorization policy
        └── activity / audit events
        │
        ▼
Canonical capability repository
        │
        ▼
PostgreSQL / PostGIS + Object Storage
```

## Chassis handoff

The authenticated Exchange already treats `capabilities` as one of four governed `ExchangeLens` values. Capability Enrichment must not add another bottom navigation system, map, drawer, card framework, or detail controller.

After onboarding, canonical capability data should project into the existing `ExchangeRecord` contract and the existing Capabilities lens. The lens remains responsible for continuous management and cross-lens actions such as matching, referring, following, sharing, evidence management, and publishing as those workflows become operational.

## Progressive integration points

The reference module is intentionally designed so downstream systems can replace deterministic adapters independently:

| Reference behavior | Production integration |
| --- | --- |
| deterministic organization context | Organization Profile service |
| deterministic suggestions | profile/capability recommendation service |
| reference AMACS candidates | AMACS taxonomy + mapping service |
| session-storage snapshot | authenticated capability repository |
| reference evidence items | object storage + evidence metadata service |
| local quality score | server/domain enrichment policy |
| publication intent | authorization + Exchange-ready completion |
| Capabilities preview link | canonical capability projection into Exchange |

## Route

The implemented reference route is:

```text
/onboarding/capabilities
```

The onboarding overview links into that route. The final stage returns to onboarding and separately allows a preview of `/exchange/capabilities`; it does not claim the still-separate Exchange-ready completion gate has been implemented.
