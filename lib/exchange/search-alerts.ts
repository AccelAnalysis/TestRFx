import { createHash } from "node:crypto";
import type { ExchangeLens } from "./contracts";
import { normalizeSearchState } from "./search";
import { searchExchangeRepository } from "./search-repository";
import { getPostgresPool } from "@/lib/server/postgres";

interface AlertRow {
  id: string;
  user_id: string;
  organization_id: string | null;
  lens: ExchangeLens;
  state: unknown;
  result_fingerprint: string | null;
}

function fingerprint(ids: string[], total: number) {
  const hash = createHash("sha256");
  hash.update(String(total));
  for (const id of [...ids].sort()) hash.update(`\n${id}`);
  return hash.digest("hex");
}

async function evaluateOne(row: AlertRow) {
  const state = normalizeSearchState(row.state);
  const ids: string[] = [];
  let cursor: string | undefined;
  let total = 0;
  let guard = 0;
  do {
    const page = await searchExchangeRepository({
      lens: row.lens,
      state,
      principal: { userId: row.user_id, organizationId: row.organization_id ?? undefined },
      cursor,
      limit: 100,
    });
    total = page.total;
    ids.push(...page.results.map((result) => result.record.id));
    cursor = page.nextCursor;
    guard += 1;
  } while (cursor && guard < 100);

  const nextFingerprint = fingerprint(ids, total);
  const changed = Boolean(row.result_fingerprint && row.result_fingerprint !== nextFingerprint);
  const pool = getPostgresPool();
  await pool.query(
    `UPDATE saved_searches SET result_fingerprint = $2, last_checked_at = now(), updated_at = updated_at WHERE id = $1::uuid`,
    [row.id, nextFingerprint],
  );
  if (changed) {
    await pool.query(
      `INSERT INTO activity_events (event_name, organization_id, payload)
       VALUES ('SavedSearchChanged', $1::uuid, $2::jsonb)`,
      [row.organization_id, JSON.stringify({ savedSearchId: row.id, lens: row.lens, resultCount: total })],
    );
  }
  return changed;
}

export async function evaluateSavedSearchAlerts(limit = 100) {
  const pool = getPostgresPool();
  const result = await pool.query<AlertRow>(
    `SELECT id::text, user_id::text, organization_id::text, lens, state, result_fingerprint
     FROM saved_searches
     WHERE alert_enabled = true
     ORDER BY coalesce(last_checked_at, to_timestamp(0)) ASC, updated_at ASC
     LIMIT $1`,
    [Math.max(1, Math.min(Math.floor(limit), 500))],
  );
  let changed = 0;
  let failed = 0;
  for (const row of result.rows) {
    try { if (await evaluateOne(row)) changed += 1; } catch (error) { failed += 1; console.error("Saved search alert evaluation failed", { savedSearchId: row.id, error }); }
  }
  return { checked: result.rows.length, changed, failed };
}
