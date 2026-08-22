# Intelligence — reconciled deep workflows

Intelligence remains one of the four Exchange lenses. This reconciliation restores the source-defined action → result → outcome hierarchy while preserving the shared map, search, drawer, cards, detail controller, bottom navigation, Menu, organization media, and cross-lens workflow services.

## Canonical runtime

Intelligence uses PostgreSQL through the same RFxchange Identity/active-organization authority used by Resources and Capabilities. It does not establish another session system.

Canonical persistence consists of:

- `exchange_records`
- `intelligence_records`
- `intelligence_sources`
- `intelligence_notes`
- `intelligence_relationships` for explicit domain relationships
- shared `activity_events`

Track and Follow are **not** Intelligence-owned persistence. They use shared `record_relationships`. Referrals use shared `referrals` and `referral_events`.

## Source hierarchy

The lens preserves Own View and Others View. The result of each supported action leads to the same four source-defined outcomes:

1. Decision Support
2. Opportunity / Capability Matching
3. Referral Trigger (Cross-Lens)
   - Create Referral
4. Save / Watch / Return to Exchange

Own View supports Add Insight, Edit Insight, Compare, and Track. Others View supports View Insight Detail, Add Note, Compare, and Follow / Track.

Comparison is supported across the source-defined dimensions: insights, organizations, and geographies.

## Provenance

New or updated sources are explicitly classified as one of:

- `exchange-activity`
- `participant-observation`
- `external-dataset`

The old `reference-dataset` classification is not accepted for new runtime writes. External source links must use HTTP(S). Missing provenance is shown as missing rather than synthesized.

## Geography and map behavior

The Intelligence service does not invent coordinates. Exact points are projected only when the canonical location allows exact visibility; otherwise a governed geography centroid may be used. Valid off-map Intelligence remains discoverable in the results surface.

The prior decorative/fabricated Intelligence signal overlay is removed. The shared map displays only actual located Intelligence records.

## Notes

Notes are separate from source-record content and have explicit visibility:

- personal
- organization
- shared

The service filters note visibility for the active actor before returning detail.

## Track / Follow

Track and Follow use the same `record_relationships` service as other lenses:

- own Intelligence → `tracking`
- other-organization Intelligence → `following`

A legacy `intelligence_tracking` table, if present in an older database, is migration/audit compatibility only and is not written by the reconciled runtime.

## Matching

Intelligence does not fabricate semantic matches. `intelligence_relationships` can explicitly link an Intelligence record to an RFx or Capability record. The Intelligence matching outcome returns only those governed relationships until a broader shared matching provider has an authoritative rule for Intelligence.

## Referrals

The Referral Trigger uses the same shared organization search, recipient referral-policy/fee disclosure, and shared referral lifecycle established by Resources and Capabilities.

## Static preview

Production runtime replaces reference Intelligence and Capability projections with authenticated service data. GitHub Pages has no authenticated server/database runtime, so it may retain deterministic records only as a read-only visual projection. Static preview does not report mutations as durable success.

## Migration order

Apply `db/intelligence.sql` after `db/schema.sql` and `db/shared-workflows.sql`, along with the existing geography/profile/organization-media migrations used by the Exchange projections. There is no `db/exchange-sessions.sql` dependency in the reconciled architecture.
