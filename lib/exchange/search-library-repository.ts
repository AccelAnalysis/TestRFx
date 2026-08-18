import type { ExchangeLens, ExchangeSearchState, RecentSearch, SavedSearch, SearchLibrary } from "./contracts";
import type { SearchPrincipal } from "./search-repository";
import { getPostgresPool } from "@/lib/server/postgres";
import { normalizeSearchState } from "./search";
import { requireSearchUser } from "./search-principal";

function asDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function listSearchLibrary(principal: SearchPrincipal, lens: ExchangeLens): Promise<SearchLibrary> {
  const userId = requireSearchUser(principal);
  const pool = getPostgresPool();
  const savedResult = await pool.query<{
    id: string; name: string; lens: ExchangeLens; state: unknown; alert_enabled: boolean; created_at: Date | string; updated_at: Date | string;
  }>(
    `SELECT id::text, name, lens, state, alert_enabled, created_at, updated_at
     FROM saved_searches
     WHERE user_id = $1::uuid AND lens = $2
     ORDER BY updated_at DESC
     LIMIT 100`,
    [userId, lens],
  );
  const recentResult = await pool.query<{
    id: string; lens: ExchangeLens; state: unknown; occurred_at: Date | string;
  }>(
    `SELECT id::text, lens, state, occurred_at
     FROM search_activity
     WHERE user_id = $1::uuid AND lens = $2 AND event_name = 'SearchSubmitted'
     ORDER BY occurred_at DESC
     LIMIT 25`,
    [userId, lens],
  );

  const saved: SavedSearch[] = savedResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    lens: row.lens,
    state: normalizeSearchState(row.state),
    alertEnabled: row.alert_enabled,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  }));
  const recent: RecentSearch[] = recentResult.rows.map((row) => ({
    id: row.id,
    lens: row.lens,
    state: normalizeSearchState(row.state),
    createdAt: asDate(row.occurred_at),
  }));
  return { saved, recent };
}

export async function createSavedSearch(principal: SearchPrincipal, input: { name: string; lens: ExchangeLens; state: ExchangeSearchState; alertEnabled?: boolean }) {
  const userId = requireSearchUser(principal);
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new Error("Saved searches require a name.");
  const pool = getPostgresPool();
  const result = await pool.query<{
    id: string; name: string; lens: ExchangeLens; state: unknown; alert_enabled: boolean; created_at: Date | string; updated_at: Date | string;
  }>(
    `INSERT INTO saved_searches (user_id, organization_id, name, lens, state, alert_enabled)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6)
     RETURNING id::text, name, lens, state, alert_enabled, created_at, updated_at`,
    [userId, principal.organizationId ?? null, name, input.lens, JSON.stringify(normalizeSearchState(input.state)), Boolean(input.alertEnabled)],
  );
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    lens: row.lens,
    state: normalizeSearchState(row.state),
    alertEnabled: row.alert_enabled,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  } satisfies SavedSearch;
}

export async function updateSavedSearch(principal: SearchPrincipal, id: string, patch: { name?: string; state?: ExchangeSearchState; alertEnabled?: boolean }) {
  const userId = requireSearchUser(principal);
  const pool = getPostgresPool();
  const current = await pool.query<{ name: string; state: unknown; alert_enabled: boolean }>(
    `SELECT name, state, alert_enabled FROM saved_searches WHERE id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [id, userId],
  );
  if (!current.rowCount) return undefined;
  const existing = current.rows[0];
  const nextName = patch.name === undefined ? existing.name : patch.name.trim().slice(0, 120);
  if (!nextName) throw new Error("Saved searches require a name.");
  const nextState = patch.state === undefined ? normalizeSearchState(existing.state) : normalizeSearchState(patch.state);
  const nextAlert = patch.alertEnabled === undefined ? existing.alert_enabled : patch.alertEnabled;
  const updated = await pool.query<{
    id: string; name: string; lens: ExchangeLens; state: unknown; alert_enabled: boolean; created_at: Date | string; updated_at: Date | string;
  }>(
    `UPDATE saved_searches
     SET name = $3, state = $4::jsonb, alert_enabled = $5, updated_at = now()
     WHERE id = $1::uuid AND user_id = $2::uuid
     RETURNING id::text, name, lens, state, alert_enabled, created_at, updated_at`,
    [id, userId, nextName, JSON.stringify(nextState), nextAlert],
  );
  const row = updated.rows[0];
  return {
    id: row.id,
    name: row.name,
    lens: row.lens,
    state: normalizeSearchState(row.state),
    alertEnabled: row.alert_enabled,
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  } satisfies SavedSearch;
}

export async function deleteSavedSearch(principal: SearchPrincipal, id: string) {
  const userId = requireSearchUser(principal);
  const pool = getPostgresPool();
  const result = await pool.query(`DELETE FROM saved_searches WHERE id = $1::uuid AND user_id = $2::uuid`, [id, userId]);
  return Boolean(result.rowCount);
}

export async function recordRecentSearch(principal: SearchPrincipal, input: { lens: ExchangeLens; state: ExchangeSearchState; resultCount: number }) {
  const userId = requireSearchUser(principal);
  const pool = getPostgresPool();
  await pool.query(
    `INSERT INTO search_activity (event_name, user_id, organization_id, lens, state, result_count)
     VALUES ('SearchSubmitted', $1::uuid, $2::uuid, $3, $4::jsonb, $5)`,
    [userId, principal.organizationId ?? null, input.lens, JSON.stringify(normalizeSearchState(input.state)), Math.max(0, Math.floor(input.resultCount))],
  );
}
