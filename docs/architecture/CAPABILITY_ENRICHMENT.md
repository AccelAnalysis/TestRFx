# Identity & Onboarding → Capability Enrichment

Capability Enrichment initializes and expands the organization's capability identity before the separate Review & Completion Checkpoint. It is not a second authenticated Capabilities application, and it does not own Exchange activation.

## Source-defined hierarchy

The onboarding source defines exactly six branches under **Organization / Capabilities Enrichment (Multi-Step)**. This implementation preserves those branches and only the children explicitly named by the source:

```text
Capability Enrichment
├── Core Profile Details
│   ├── Organization overview
│   ├── Contacts
│   ├── Description
│   └── Key info
├── Industry & Services
│   ├── Industries served
│   └── Service offerings
├── Capabilities Entry
│   ├── Detailed capabilities
│   └── Solutions
├── AMACS Mapping / AI-to-AMACS Assistance
│   ├── AI assistance
│   └── Suggestions
├── Evidence / Certifications
│   ├── Certifications
│   ├── Licenses
│   ├── Case studies
│   └── Supporting documents
└── Tags / Keywords / Specialties
    ├── Tags
    ├── Keywords
    └── Specialties
```

Review, completeness scoring, missing-item prompts, save/continue-later policy, and Exchange readiness are intentionally **not** children of Capability Enrichment. The source places them in the following Review & Completion Checkpoint, implemented at `/onboarding/completion`.

## Navigation contract

The root, each branch, and each leaf have addressable routes:

```text
/onboarding/capabilities
/onboarding/capabilities/{section}
/onboarding/capabilities/{section}/{task}
```

The URL is the nested navigation state. Breadcrumbs and the hierarchy rail derive from the same route contract, so opening, refreshing, sharing, or returning to a leaf does not depend on component-local menu state.

The final source-defined leaf links to `/onboarding/completion`; it does not create a capability-publication step inside onboarding.

## Canonical ownership

Capability Enrichment does not duplicate information already owned by Organization Profile.

- Core Profile Details reads the canonical organization/profile/contact records and hands editing back to `/onboarding/organization-profile`.
- Industry & Services persists industries and service offerings to `organization_profiles`; capability records only consume that context.
- Detailed capability claims and solutions persist to `organization_capability_claims`.
- Evidence persists to `organization_capability_evidence` and is attached to a specific capability claim.
- Tags, keywords, and specialties persist to `organization_capability_profiles`.
- Enrichment progress persists to `onboarding_capability_progress`.

There is no session-storage capability snapshot and no deterministic reference organization fallback.

## AMACS runtime integration

RFxchange consumes an immutable deployed AMACS release rather than inventing runtime taxonomy IDs.

The runtime projection stores:

- AMACS release version;
- source commit SHA;
- import timestamp;
- canonical concepts and aliases;
- per-record checksums.

`npm run amacs:import -- /path/to/amacs-release/<version>` imports the immutable release output produced by the AMACS repository's `scripts/build_release.py`. Existing releases are not overwritten; an import with the same version but a different source commit is rejected.

Manual Suggestions searches only the active deployed release. Accepting a mapping verifies that the selected concept is active and matchable in that release before the organization capability assertion is updated.

### AI-to-AMACS assistance

AI interpretation is provider-neutral and optional. If `AMACS_INTERPRETATION_URL` is configured, RFxchange sends ordinary capability text plus the active AMACS release provenance to that service. Returned concept IDs are validated against the active release before they are shown. The participant must still explicitly accept a mapping.

If no interpretation provider is configured, the AI leaf reports the service as unavailable and directs the user to the real manual Suggestions search. There is no deterministic or fabricated AI fallback.

## Evidence

The source requires certifications, licenses, case studies, and supporting documents. Those are the only evidence children created here.

Evidence records retain a title, issuer where applicable, source URL, notes, and capability-claim relationship. Supporting documents require an authoritative URL. The UI no longer manufactures attachment names or claims a document was uploaded when no storage service exists.

A future object-storage implementation may replace URL-backed supporting documents without changing the evidence relationship or route hierarchy.

## Authorization and service behavior

Capability data is server-persisted through PostgreSQL. Mutation and private snapshot endpoints require an authenticated user context from the trusted identity layer and verify `organization_memberships` before reading or writing organization-owned onboarding data.

The current integration expects the trusted identity gateway to inject `x-rfxchange-user-id` on application/API requests. A deployment that has not connected the identity gateway or `DATABASE_URL` receives an explicit authentication/service-unavailable response. The module does not silently fall back to browser storage or reference data.

## Activity events

Meaningful mutations emit chassis activity events, including capability claim creation/update/archive, solution updates, accepted AMACS mappings, evidence changes, discoverability changes, organization capability-context changes, and persisted onboarding progress.

## Database migration

Apply:

```text
db/schema.sql
db/organization-profile.sql
db/capability-enrichment.sql
```

The Capability Enrichment migration adds the AMACS runtime projection, canonical capability-enrichment records, progress storage, and `organization_profiles.service_offerings`.

## Environment

Production service connections use:

```text
DATABASE_URL=postgresql://...
DATABASE_POOL_MAX=10                 # optional
DATABASE_SSL=require                 # optional
AMACS_INTERPRETATION_URL=https://... # optional; AI assistance only
AMACS_INTERPRETATION_TOKEN=...       # optional provider credential
```

AMACS manual Suggestions requires only the deployed AMACS projection in PostgreSQL. AI assistance is never required to complete the manual mapping workflow.

## Chassis boundary

The authenticated Exchange still owns the persistent map, universal search, result drawer, action rail, record cards, detail controller, and four lenses. Capability Enrichment creates/updates the organization capability records that can later be projected into the existing Capabilities lens; it does not recreate the Exchange shell.
