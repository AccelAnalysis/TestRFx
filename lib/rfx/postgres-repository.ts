import "server-only";

import { neon } from "@neondatabase/serverless";
import type { RfxWorkflowEntry, RfxWorkflowPerspective, RfxWorkspace } from "./contracts";
import type { RfxActorContext } from "./runtime-actor";
import { coerceRfxWorkspace, createRfxWorkspace, withWorkspaceEntry } from "./workspace";

let schemaReady: Promise<void> | undefined;

function database() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("RFx Postgres service is not configured. Set DATABASE_URL to enable shared RFx workspace persistence.");
  return neon(url);
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const sql = database();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rfx_workspaces (
        record_id text NOT NULL,
        perspective text NOT NULL CHECK (perspective IN ('issuer', 'responder')),
        organization_id text,
        entry text NOT NULL,
        state jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        created_by_user_id text,
        updated_by_user_id text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.query(`ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS organization_id text`);
    await sql.query(`ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS created_by_user_id text`);
    await sql.query(`ALTER TABLE rfx_workspaces ADD COLUMN IF NOT EXISTS updated_by_user_id text`);
    await sql.query(`ALTER TABLE rfx_workspaces DROP CONSTRAINT IF EXISTS rfx_workspaces_pkey`);
    await sql.query(`CREATE UNIQUE INDEX IF NOT EXISTS rfx_workspaces_org_unique ON rfx_workspaces(record_id, perspective, organization_id)`);

    await sql.query(`
      CREATE TABLE IF NOT EXISTS rfx_workspace_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        record_id text NOT NULL,
        perspective text NOT NULL,
        organization_id text,
        actor_user_id text,
        event_name text NOT NULL,
        workspace_version integer NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.query(`ALTER TABLE rfx_workspace_events ADD COLUMN IF NOT EXISTS organization_id text`);
    await sql.query(`ALTER TABLE rfx_workspace_events ADD COLUMN IF NOT EXISTS actor_user_id text`);
    await sql.query(`CREATE INDEX IF NOT EXISTS rfx_workspace_events_record_idx ON rfx_workspace_events(record_id, perspective, organization_id, occurred_at DESC)`);
  })();
  return schemaReady;
}

export async function loadPostgresRfxWorkspace(
  recordId: string,
  perspective: RfxWorkflowPerspective,
  entry: RfxWorkflowEntry,
  actor: RfxActorContext,
): Promise<RfxWorkspace> {
  await ensureSchema();
  const sql = database();
  const rows = await sql.query(
    `SELECT state
       FROM rfx_workspaces
      WHERE record_id = $1
        AND perspective = $2
        AND organization_id = $3
      LIMIT 1`,
    [recordId, perspective, actor.organizationId],
  ) as Array<{ state: unknown }>;

  if (!rows.length) {
    const workspace = createRfxWorkspace(recordId, entry);
    return savePostgresRfxWorkspace(workspace, actor);
  }

  return withWorkspaceEntry(coerceRfxWorkspace(rows[0].state, recordId, entry), entry);
}

export async function savePostgresRfxWorkspace(workspace: RfxWorkspace, actor: RfxActorContext): Promise<RfxWorkspace> {
  await ensureSchema();
  const sql = database();
  const next: RfxWorkspace = { ...workspace, version: Math.max(1, workspace.version), updatedAt: new Date().toISOString() };

  await sql.query(
    `INSERT INTO rfx_workspaces (
       record_id, perspective, organization_id, entry, state, version,
       created_by_user_id, updated_by_user_id, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7, $8::timestamptz, $9::timestamptz)
     ON CONFLICT (record_id, perspective, organization_id)
     DO UPDATE SET
       entry = EXCLUDED.entry,
       state = EXCLUDED.state,
       version = EXCLUDED.version,
       updated_by_user_id = EXCLUDED.updated_by_user_id,
       updated_at = EXCLUDED.updated_at`,
    [next.recordId, next.perspective, actor.organizationId, next.entry, JSON.stringify(next), next.version, actor.userId, next.createdAt, next.updatedAt],
  );

  await sql.query(
    `INSERT INTO rfx_workspace_events (
       record_id, perspective, organization_id, actor_user_id,
       event_name, workspace_version, payload
     )
     VALUES ($1, $2, $3, $4, 'workspace.saved', $5, $6::jsonb)`,
    [next.recordId, next.perspective, actor.organizationId, actor.userId, next.version, JSON.stringify({ entry: next.entry, activePath: next.activePath, completedNodeIds: next.completedNodeIds })],
  );

  return next;
}
