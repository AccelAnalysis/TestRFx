# Resource Provider Seeding, Unclaimed Listings & Claims

This layer lets RFxchange establish useful Resources density before every provider has registered, while preserving the canonical Organization → Location → Resource model and the existing organization-claim workflow.

## Governing distinctions

RFxchange keeps these states independent:

- **Provider class**: Community / Institutional or Commercial
- **Participation policy**: free standard participation or paid commercial participation
- **Claim state**: unclaimed, claimed, or verified
- **Placement**: organic, featured, or sponsored
- **Trust / recommendation**: separate governed states; neither payment nor claiming implies endorsement

A commercial provider may claim and correct its factual organization identity for free. Paid participation governs commercial Resource publishing/lead-generation features, not ownership of the organization identity.

## Provider classification

`lib/resources/provider-classification.ts` preserves the major Resource categories and maps known provider types to a default class. Examples:

- economic-development offices, chambers, SBDCs, APEX, workforce boards, public universities, libraries, public/nonprofit incubators, and qualifying CDFIs default to **Community / Institutional → free standard**;
- banks, credit unions, commercial lenders, coworking operators, private training companies, consultants, commercial real-estate providers, staffing firms, and other commercial service providers default to **Commercial → paid participation**.

Unknown provider types do not receive an automatic class. Manual overrides require a documented classification basis before promotion.

## Market seed packs

`lib/resources/market-seed-packs.ts` defines reusable market scopes and target source/provider families. The initial definitions are:

- `hampton-roads-va`
- `richmond-va`

A market pack is not itself an external dataset. It tells ingestion adapters what provider families and Resource categories to seek in that market. Each source adapter retains its own geographic/service-territory authority.

## Ingestion lifecycle

```text
External source / curated seed file
          ↓
Trusted ingestion API
          ↓
resource_ingestion_runs
          ↓
resource_ingestion_candidates
          ↓
Normalize + classify
          ↓
Canonical duplicate check
   ┌──────┼─────────┐
   │      │         │
 ready  review   exact match
   │      │         │
   └──────┴────┬────┘
               ↓
       explicit promotion
               ↓
Canonical Organization
Organization Identity = unclaimed
Location (when sourced)
Resource Provider Profile
Exchange Resource record
Source provenance
               ↓
Resources map / drawer / detail
```

Staging never creates a visible listing. Promotion is an explicit action protected by `RFXCHANGE_INGESTION_TOKEN`.

## Deduplication

The importer uses the existing canonical organization model rather than creating a second business directory. Exact primary-domain matches are treated as canonical duplicates. Fuzzy organization-name matches use the repository's existing PostgreSQL `pg_trgm` capability, with locality strengthening the score. Possible duplicates stop for an explicit canonical-organization decision.

The same organization may therefore accumulate multiple source records without creating duplicate map markers.

## Provenance

Every promoted listing retains:

- source key and source name;
- source authority class (authoritative, licensed, curated);
- source record identifier and optional URL;
- retrieval / last-checked timestamps;
- raw payload hash and source snapshot;
- canonical organization and Exchange record links.

The Resource detail surface exposes human-readable source attribution. Source attribution is not verification, sponsorship, recommendation, or endorsement.

## Unclaimed presentation

Unclaimed Resource Provider records:

- remain normal Resource records in the shared Exchange chassis;
- use a neutral map-marker color rather than ordinary Resources green;
- display **Unclaimed listing** on cards/details;
- expose source attribution;
- provide a **Claim listing** handoff.

The static TestRFx preview includes explicitly named preview fixtures solely to validate these visuals. They are not real-world provider assertions and are not promoted through the runtime ingestion tables.

## Claim handoff

`lib/resources/claim-handoff.ts` routes unclaimed listings into the existing Identity & Onboarding organization workflow.

If the listing has a canonical organization ID, the handoff opens the existing-organization review/claim path directly. The Resource detail URL is retained as `returnTo`, so successful organization resolution can return the member to the same Resource context.

No Resource-specific claim database or duplicate authority workflow is created.

## Runtime APIs

### Read seed-pack definitions

`GET /api/resources/providers/seed-packs`

Returns the market definitions, provider types, and Resource categories.

### Stage / promote provider candidates

`POST /api/resources/providers/ingest`

Requires header:

```text
x-rfxchange-ingestion-token: <RFXCHANGE_INGESTION_TOKEN>
```

Supported actions:

- `stage`: normalize, classify, deduplicate, and persist candidates for review;
- `promote`: create/attach the canonical Organization, Location, Resource Provider profile, Exchange Resource record, and provenance record.

## Exchange results integration

`/api/exchange/results?lens=resources` merges promoted database-backed provider records with the current TestRFx reference catalog when the database is configured. The current mounted Exchange client still uses the repository's reference record set directly; migrating the entire Exchange shell to the server result service is a broader chassis/data-read change and is intentionally not hidden inside this PR.

## External-source boundary

This PR does not claim to have installed or licensed any national or commercial business directory. Future adapters—for example authoritative government datasets, regulated financial-institution data, licensed commercial directories, or curated market seed files—must map into the same staging contract and record their use/license basis in `external_resource_sources`.

No external source is allowed to bypass provenance, classification, deduplication, or explicit promotion.
