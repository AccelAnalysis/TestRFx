# Hampton Roads, VA — Resource Provider Seed Pack

Version: `0.1.0`  
Prepared: `2026-08-22`  
Status: **research candidate / staging only**

This pack contains **32 real provider candidates** for the RFxchange Resources ecosystem in Hampton Roads, Virginia:

- **24 community / institutional candidates** — proposed `free_standard`
- **8 commercial candidates** — proposed `commercial_paid`
- **6 classification-review flags**
- **17 canonicalization-review flags**
- **40 sourced location rows**
- **45 provenance rows**

It is intentionally a **data-only pack**. It does not create canonical Organizations, claim records, Resource records, entitlements, coordinates, or billing state.

## Purpose

The pack is designed to be reconciled with the in-progress **Resource Provider Seeding, Unclaimed Listings & Claims** framework before any live import. It assumes that framework will stage candidates before canonical creation, preserve provenance, run entity resolution/deduplication, classify provider participation, geocode approved locations, and hand unclaimed records into the existing organization-claim workflow.

## Files

- `candidates.csv` — one row per provider candidate, including provider/participation classifications, entity-shape and parent hints, review flags, aliases, service-area labels, resource-category candidates, and review notes.
- `locations.csv` — normalized candidate locations keyed back to `seed_key`; no coordinates are fabricated.
- `sources.csv` — normalized provenance ledger for the official public sources used by the pack.

The normalized CSV layout is deliberate: it can be mapped into the framework's eventual staging tables without pre-empting their final table or field names.

## Import rules

1. **Do not insert these rows directly into canonical Organizations.**
2. Import to the framework's staging-candidate layer after its schema is finalized.
3. Run organization/entity resolution before creating anything new.
4. Treat every approved listing as `unclaimed` until the existing claim workflow changes that state.
5. Before claim, publish only source-supported factual fields permitted by policy; do not turn candidate resource categories into provider-authored marketing copy.
6. Geocode after normalization/deduplication. This pack intentionally does **not** invent coordinates.
7. Provider class and participation policy are *candidates*, not irreversible facts. Flagged records require admin review.

## Important deduplication / canonicalization cases

### TowneBank / Old Point

Do **not** seed Old Point National Bank as a second current bank. TowneBank states Old Point locations, accounts, and systems officially came under the TowneBank name on February 9, 2026. Old Point names are retained as aliases/source identifiers so importer matching can collapse older source records into the TowneBank organization.

### Government departments and programs

Local economic-development departments, The HIVE, REaKTOR, Launchpad, and ODU IIE may be operating units/programs rather than independent legal organizations. The future importer should reconcile them to existing City/County/University organization identities where appropriate while preserving provider-specific profiles and locations.

### Credit unions

Langley, BayPort, 1st Advantage, Chartway, and ABNB are included in the **commercial candidate** lane because they offer business/commercial financial services. Because credit unions are member-owned/not-for-profit institutions, each is flagged for participation-policy review before `commercial_paid` is made authoritative.

## Geography

`hampton-roads-va` is a market-seeding boundary for establishing useful provider density. It is not asserted as a legal, statistical, or exclusive service-territory definition.

## Source-use discipline

`sources.csv` stores official public URLs as `public_factual_reference`. The seed pack uses facts such as identity, location, organizational relationship, and service type. It does not copy promotional descriptions from provider websites.

## Suggested reconciliation target

When the Resource Provider Seeding framework PR opens, map these neutral fields into its authoritative model:

- `seed_key` → staging/source-record key
- provider / participation candidates → provider classification model
- `locations.csv` → normalized staging locations, then geocoding
- `sources.csv` → external source/source-record provenance
- aliases / parent candidates → entity-resolution evidence
- `ingestion_status` + review flags → admin ingestion/review state
- `intended_claim_state=unclaimed` → existing organization identity / claim state after canonical approval

No competing identity, map, claim, or entitlement architecture should be introduced by this pack.
