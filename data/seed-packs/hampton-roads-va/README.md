# Hampton Roads, VA — Resource Provider Seed Pack

Version: `0.2.0`  
Prepared / reconciled: `2026-08-22`  
Status: **source-backed seed data, ready for protected staging**

This pack contains **32 real Resource Provider candidates** for Hampton Roads, Virginia:

- **24 Community / Institutional** → `free_standard`
- **8 Commercial** → `commercial_paid`
- **0 provider-classification review flags** after reconciliation to the merged Resource Provider taxonomy
- **17 canonicalization / entity-shape review flags**
- **40 sourced location rows**
- **45 provenance rows**
- **0 fabricated coordinates**

The pack is reconciled directly to the Resource Provider Seeding, Unclaimed Listings & Claims framework merged in PR #65. It uses that framework's exact provider-type IDs, Resource category IDs, classification policy, staging API, deduplication behavior, canonical Organization model, and existing organization-claim handoff.

## What this PR does

1. Replaces the two fictional Resource Provider preview fixtures with a **read-only, source-backed projection of these 32 Hampton Roads candidates**, so the current TestRFx Resources drawer/detail experience is populated with real providers immediately.
2. Keeps those preview records **off-map** until an address has passed review and an authoritative geocoding/location process supplies coordinates. The pack does not guess coordinates.
3. Provides normalized research data for candidate identity, locations, provider classification, service/resource category, provenance, aliases, parent/program relationships, and review notes.
4. Adds `scripts/stage-hampton-roads-provider-seed-pack.mjs`, which converts the CSV data into PR #65's exact `ProviderSourceCandidate` + `ExternalSourceDescriptor` contract and submits each candidate through the protected ingestion endpoint.
5. Does **not** automatically promote staging candidates into canonical Organizations/Resources. Promotion remains the explicit admin step after deduplication and review, exactly as PR #65 requires.

## Files

- `candidates.csv` — one row per provider candidate using the merged framework's exact provider-type and Resource-category IDs, plus source-backed service name/summary, participation class, entity-shape hints, aliases, and review flags.
- `locations.csv` — 40 sourced locations keyed to the provider seed records. Rows needing address review remain flagged rather than being silently normalized.
- `sources.csv` — 45 provenance rows with official public source URLs, retrieval date, source type, use basis, and facts supported.
- `../../../../scripts/stage-hampton-roads-provider-seed-pack.mjs` — protected staging utility; no external npm dependency is required.

## Framework reconciliation

The original research pass used descriptive provider-type names. PR #65 subsequently established the authoritative IDs. This pack now maps directly to them, including:

- Hampton Roads Alliance → `regional-development-organization`
- local economic-development departments → `economic-development-office`
- Newport News / Williamsburg EDAs → `economic-development-authority`
- Chambers → `chamber-of-commerce`
- Hampton Roads SBDC → `sbdc`
- Hampton Roads Workforce Council → `workforce-board`
- ODU IIE → `public-university`
- 757 Collab / Launchpad / REaKTOR → `nonprofit-incubator`
- Bloom Coworking → `public-coworking`
- The HIVE → `public-program`
- Retail Alliance / Virginia Maritime Association → `nonprofit-business-association`
- TowneBank / Atlantic Union Bank → `bank`
- Langley / BayPort / 1st Advantage / Chartway / ABNB → `credit-union`
- Gather Workspaces → `coworking-space`

Because `bank`, `credit-union`, and `coworking-space` are explicit Commercial provider types in PR #65, the provisional credit-union classification-review flags have been removed. Identity claiming and factual corrections remain free; commercial Resource participation remains subject to `commercial_paid` entitlement.

## Important canonicalization cases

### TowneBank / Old Point

Do **not** seed Old Point National Bank as a second current bank. TowneBank states that Old Point locations, accounts, and systems officially came under the TowneBank name on **February 9, 2026**. The Old Point names remain aliases/source identifiers so entity resolution can absorb older records into the TowneBank organization rather than create a duplicate.

### Government departments and programs

Local economic-development departments, The HIVE, REaKTOR, Launchpad, ODU IIE, and Bloom may be operating units, programs, DBAs, or jointly sponsored initiatives rather than independent legal organizations. Their parent/entity-shape hints are carried in the staging `raw` payload so the admin/deduplication review can attach them to the correct canonical Organization without losing provider-specific identity or provenance.

### Locations requiring review

- **Hampton REaKTOR**: no street address is promoted from this pack; it remains off-map until an authoritative current location is resolved.
- **York County Economic & Tourism Development**: the candidate address remains `needs_review` because official county materials have shown different office addresses; the staging utility deliberately omits that address from the canonical candidate.
- **Hampton Roads SBDC secondary offices**: source labels/secondary-office details remain in provenance for review; the clearly sourced main-contact location is used as the staging candidate address.

## Dry-run validation

From the repository root:

```bash
node scripts/stage-hampton-roads-provider-seed-pack.mjs --dry-run
```

The utility validates the pack cardinality, source references, duplicate seed IDs, classification readiness, location-review count, and confirms that no coordinates are supplied.

## Stage into a configured TestRFx runtime

The runtime must have PR #65's database migration applied and `RFXCHANGE_INGESTION_TOKEN` configured. Then:

```bash
RFXCHANGE_INGESTION_TOKEN="..." \
node scripts/stage-hampton-roads-provider-seed-pack.mjs \
  --base-url=https://your-testrfx-runtime.example
```

Each provider is sent through `/api/resources/providers/ingest` as a `stage` action. The framework then performs normalization, provider classification, existing Organization/domain/name/locality deduplication, and writes the candidate plus provenance into the ingestion review layer.

**Staging is not promotion.** No candidate becomes a canonical visible runtime listing until an authorized reviewer explicitly promotes it (or attaches it to an existing canonical Organization) through the framework's promotion path.

## Source-use discipline

The pack is built from official public provider, institution, university, financial-institution, and local-government pages. `sources.csv` records those sources as `public_factual_reference`. The dataset uses factual identity, location, organizational relationship, and service-type information; it does not copy provider marketing descriptions.

The result is additive to the RFxchange chassis: one canonical Organization/Location/Resource graph, one existing claim workflow, and one Resources lens—not a parallel directory or identity system.
