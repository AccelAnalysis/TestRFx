import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Pool } = pg;

function checksum(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonl(filePath) {
  const text = await readFile(filePath, "utf8");
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line) => ({
    record: JSON.parse(line),
    checksum: checksum(line),
  }));
}

async function main() {
  const releaseDir = process.argv[2] ?? process.env.AMACS_RELEASE_DIR;
  if (!releaseDir) throw new Error("Usage: npm run amacs:import -- /absolute/path/to/<amacs release version>");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");

  const manifest = JSON.parse(await readFile(path.join(releaseDir, "manifest.json"), "utf8"));
  if (!manifest.version || !manifest.released_at || !/^[0-9a-f]{40}$/i.test(manifest.source_commit ?? "")) {
    throw new Error("AMACS manifest is missing version, released_at, or a full source_commit SHA.");
  }

  const concepts = await readJsonl(path.join(releaseDir, "source", "concepts.jsonl"));
  const aliases = await readJsonl(path.join(releaseDir, "source", "aliases.jsonl"));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const existing = await client.query(
      "SELECT id, source_commit_sha FROM amacs_runtime_releases WHERE version = $1 FOR UPDATE",
      [manifest.version],
    );

    let releaseId;
    if (existing.rowCount) {
      const row = existing.rows[0];
      if (row.source_commit_sha.trim() !== manifest.source_commit.toLowerCase()) {
        throw new Error(`AMACS ${manifest.version} is already imported from a different source commit; release records are immutable.`);
      }
      releaseId = row.id;
      const counts = await client.query(
        "SELECT (SELECT count(*)::int FROM amacs_runtime_concepts WHERE release_id = $1) concepts, (SELECT count(*)::int FROM amacs_runtime_aliases WHERE release_id = $1) aliases",
        [releaseId],
      );
      if (counts.rows[0].concepts !== concepts.length || counts.rows[0].aliases !== aliases.length) {
        throw new Error(`AMACS ${manifest.version} already exists but its imported record counts differ; refusing to mutate an immutable release.`);
      }
    } else {
      const inserted = await client.query(
        `INSERT INTO amacs_runtime_releases (version, status, released_at, source_commit_sha, manifest)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
        [manifest.version, manifest.status ?? "development", manifest.released_at, manifest.source_commit.toLowerCase(), JSON.stringify(manifest)],
      );
      releaseId = inserted.rows[0].id;

      for (const { record, checksum: recordChecksum } of concepts) {
        await client.query(
          `INSERT INTO amacs_runtime_concepts
           (release_id, concept_id, concept_type, preferred_label, definition, status, matchable, editorial_maturity, primary_parent_id, version_introduced, record_checksum, source_record)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [releaseId, record.concept_id, record.concept_type, record.preferred_label, record.definition, record.status, Boolean(record.matchable), record.editorial_maturity ?? null, record.primary_parent_id ?? null, record.version_introduced ?? null, recordChecksum, JSON.stringify(record)],
        );
      }

      for (const { record, checksum: recordChecksum } of aliases) {
        await client.query(
          `INSERT INTO amacs_runtime_aliases
           (release_id, alias_id, concept_id, alias, alias_type, language, region, status, record_checksum, source_record)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
          [releaseId, record.alias_id, record.concept_id, record.alias, record.alias_type, record.language, record.region ?? null, record.status, recordChecksum, JSON.stringify(record)],
        );
      }
    }

    await client.query("UPDATE amacs_runtime_releases SET active = false WHERE active");
    await client.query("UPDATE amacs_runtime_releases SET active = true WHERE id = $1", [releaseId]);
    await client.query("COMMIT");
    console.log(`Activated AMACS ${manifest.version} (${concepts.length} concepts, ${aliases.length} aliases) from ${manifest.source_commit}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
