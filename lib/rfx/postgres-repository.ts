import "server-only";

import { neon } from "@neondatabase/serverless";
import type { RfxWorkflowEntry, RfxWorkflowPerspective, RfxWorkspace } from "./contracts";
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
        entry text NOT NULL,
        state jsonb NOT NULL,
        version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (record_id, perspective)
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS rfx_workspace_events (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        record_id text NOT NULL,
        perspective text NOT NULL,
        event_name text NOT NULL,
        workspace_version integer NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await sql.query(`CREATE INDEX IF NOT EXISTS rfx_workspace_events_record_idx ON rfx_workspace_events(record_id, perspective, occurred_at DESC)`);
  })();
  return schemaReady;
}

export async function loadPostgresRfxWorkspace(recordId: string, perspective: RfxWorkflowPerspective, entry: RfxWorkflowEntry): Promise<RfxWorkspace> {
  await ensureSchema();
  const sql = database();
  const rows = await sql.query("SELECT state FROM rfx_workspaces WHERE record_id = $1 AND perspective = $2 LIMIT 1", [recordId, perspective]) as Array<{ state: unknown }>;
  if (!rows.length) {
    const workspace = createRfxWorkspace(recordId, entry);
    return savePostgresRfxWorkspace(workspace);
  }
  return withWorkspaceEntry(coerceRfxWorkspace(rows[0].state, recordId, entry), entry);
}

export async function savePostgresRfxWorkspace(workspace: RfxWorkspace): Promise<RfxWorkspace> {
  await ensureSchema();
  const sql = database();
  const next: RfxWorkspace = { ...workspace, version: Math.max(1, workspace.version), updatedAt: new Date().toISOString() };
  await sql.query(
    `INSERT INTO rfx_workspaces (record_id, perspective, entry, state, version, created_at, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $7::timestamptz)
     ON CONFLICT (record_id, perspective)
     DO UPDATE SET entry = EXCLUDED.entry, state = EXCLUDED.state, version = EXCLUDED.version, updated_at = EXCLUDED.updated_at`,
    [next.recordId, next.perspective, next.entry, JSON.stringify(next), next.version, next.createdAt, next.updatedAt],
  );
  await sql.query(
    `INSERT INTO rfx_workspace_events (record_id, perspective, event_name, workspace_version, payload)
     VALUES ($1, $2, 'workspace.saved', $3, $4::jsonb)`,
    [next.recordId, next.perspective, next.version, JSON.stringify({ entry: next.entry, activePath: next.activePath, completedNodeIds: next.completedNodeIds })],
  );
  return next;
}
