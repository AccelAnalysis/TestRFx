-- RFx mobile publication/submission runtime invariants.
-- Apply after db/schema.sql and db/rfx-domain.sql.

-- An Exchange RFx record has one canonical RFx domain projection. This unique
-- index is also the conflict target used by the authenticated publish service.
CREATE UNIQUE INDEX IF NOT EXISTS rfx_records_exchange_record_unique
  ON rfx_records(exchange_record_id);

-- A responding organization has at most one canonical response and pursuit
-- state per RFx. These indexes mirror the upsert keys used by hosted and
-- external-submission transaction services and preserve one response history
-- head per organization without conflating different responders.
CREATE UNIQUE INDEX IF NOT EXISTS rfx_responses_record_organization_unique
  ON rfx_responses(rfx_record_id, respondent_organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS rfx_pursuits_record_organization_unique
  ON rfx_pursuits(rfx_record_id, organization_id);

-- Frequently used mobile workflow/status lookups.
CREATE INDEX IF NOT EXISTS rfx_responses_submitted_at_idx
  ON rfx_responses(rfx_record_id, submitted_at DESC)
  WHERE submitted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS rfx_workspace_events_actor_idx
  ON rfx_workspace_events(organization_id, actor_user_id, occurred_at DESC);
