import type { PoolClient } from "pg";
import {
  type AmacsCandidate,
  type CapabilityClaimRecord,
  type CapabilityEnrichmentSnapshot,
  type CapabilityEvidenceKind,
  type CapabilityEvidenceRecord,
} from "@/lib/onboarding/capability-enrichment";
import { query, withTransaction } from "@/lib/server/postgres";

export class CapabilityServiceError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "CapabilityServiceError";
    this.status = status;
  }
}

export async function assertOrganizationMembership(userId: string | undefined, organizationId: string) {
  if (!userId) throw new CapabilityServiceError(401, "Authenticated user context is required.");
  const membership = await query(
    "SELECT 1 FROM organization_memberships WHERE user_id = $1::uuid AND organization_id = $2::uuid LIMIT 1",
    [userId, organizationId],
  );
  if (!membership.rowCount) throw new CapabilityServiceError(403, "The authenticated user is not a member of this organization.");
}

export async function getCapabilityEnrichmentSnapshot(organizationId: string): Promise<CapabilityEnrichmentSnapshot> {
  const organization = await query<{
    id: string; name: string; legal_name: string | null; description: string | null; website: string | null;
    industries: unknown; service_offerings: string[] | null;
  }>(
    `SELECT o.id, o.name, p.legal_name, p.description, p.website, p.industries, p.service_offerings
     FROM organizations o
     LEFT JOIN organization_profiles p ON p.organization_id = o.id
     WHERE o.id = $1::uuid`,
    [organizationId],
  );
  if (!organization.rowCount) throw new CapabilityServiceError(404, "Organization not found.");
  const org = organization.rows[0];

  const contactsResult = await query<{ id: string; contact_name: string; title: string | null; email: string; phone: string | null }>(
    `SELECT id, contact_name, title, email, phone
     FROM organization_contacts WHERE organization_id = $1::uuid
     ORDER BY is_primary DESC, created_at ASC`,
    [organizationId],
  );

  const profileResult = await query<{ tags: string[]; keywords: string[]; specialties: string[] }>(
    "SELECT tags, keywords, specialties FROM organization_capability_profiles WHERE organization_id = $1::uuid",
    [organizationId],
  );

  const claimsResult = await query<{
    id: string; name: string; description: string; solution: string | null; mapping_status: "unmapped" | "accepted";
    amacs_release_id: string | null; amacs_concept_id: string | null; release_version: string | null; amacs_label: string | null;
  }>(
    `SELECT c.id, c.name, c.description, c.solution, c.mapping_status, c.amacs_release_id, c.amacs_concept_id,
            r.version AS release_version, ac.preferred_label AS amacs_label
     FROM organization_capability_claims c
     LEFT JOIN amacs_runtime_releases r ON r.id = c.amacs_release_id
     LEFT JOIN amacs_runtime_concepts ac ON ac.release_id = c.amacs_release_id AND ac.concept_id = c.amacs_concept_id
     WHERE c.organization_id = $1::uuid AND c.claim_status <> 'archived'
     ORDER BY c.created_at ASC`,
    [organizationId],
  );

  const evidenceByClaim = new Map<string, CapabilityEvidenceRecord[]>();
  if (claimsResult.rowCount) {
    const ids = claimsResult.rows.map((row) => row.id);
    const evidenceResult = await query<{
      id: string; capability_claim_id: string; kind: CapabilityEvidenceKind; label: string; issuer: string | null; source_url: string | null; notes: string | null;
    }>(
      `SELECT id, capability_claim_id, kind, label, issuer, source_url, notes
       FROM organization_capability_evidence
       WHERE capability_claim_id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [ids],
    );
    for (const row of evidenceResult.rows) {
      const list = evidenceByClaim.get(row.capability_claim_id) ?? [];
      list.push({
        id: row.id,
        capabilityClaimId: row.capability_claim_id,
        kind: row.kind,
        label: row.label,
        issuer: row.issuer ?? undefined,
        sourceUrl: row.source_url ?? undefined,
        notes: row.notes ?? undefined,
      });
      evidenceByClaim.set(row.capability_claim_id, list);
    }
  }

  const activeRelease = await query<{ id: string; version: string; source_commit_sha: string; imported_at: Date }>(
    "SELECT id, version, source_commit_sha, imported_at FROM amacs_runtime_releases WHERE active = true LIMIT 1",
  );
  const progressResult = await query<{ last_path: string[]; completed_leaf_paths: string[]; updated_at: Date }>(
    "SELECT last_path, completed_leaf_paths, updated_at FROM onboarding_capability_progress WHERE organization_id = $1::uuid",
    [organizationId],
  );

  const claims: CapabilityClaimRecord[] = claimsResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    solution: row.solution ?? undefined,
    amacsReleaseId: row.amacs_release_id ?? undefined,
    amacsReleaseVersion: row.release_version ?? undefined,
    amacsConceptId: row.amacs_concept_id ?? undefined,
    amacsLabel: row.amacs_label ?? undefined,
    mappingStatus: row.mapping_status,
    evidence: evidenceByClaim.get(row.id) ?? [],
  }));

  const profile = profileResult.rows[0];
  const progress = progressResult.rows[0];
  const industries = Array.isArray(org.industries) ? org.industries.filter((item): item is string => typeof item === "string") : [];

  return {
    organization: {
      organizationId: org.id,
      organizationName: org.name,
      legalName: org.legal_name ?? undefined,
      description: org.description ?? undefined,
      website: org.website ?? undefined,
      industries,
      services: org.service_offerings ?? [],
      contacts: contactsResult.rows.map((row) => ({ id: row.id, name: row.contact_name, title: row.title ?? undefined, email: row.email, phone: row.phone ?? undefined })),
    },
    claims,
    tags: profile?.tags ?? [],
    keywords: profile?.keywords ?? [],
    specialties: profile?.specialties ?? [],
    amacsRelease: activeRelease.rows[0] ? {
      id: activeRelease.rows[0].id,
      version: activeRelease.rows[0].version,
      sourceCommitSha: activeRelease.rows[0].source_commit_sha.trim(),
      importedAt: activeRelease.rows[0].imported_at.toISOString(),
    } : undefined,
    progress: {
      lastPath: progress?.last_path ?? [],
      completedLeafPaths: progress?.completed_leaf_paths ?? [],
      updatedAt: progress?.updated_at.toISOString(),
    },
  };
}

async function recordActivity(client: PoolClient, eventName: string, actorUserId: string, organizationId: string, payload: Record<string, unknown>) {
  await client.query(
    "INSERT INTO activity_events (event_name, actor_user_id, organization_id, payload) VALUES ($1, $2::uuid, $3::uuid, $4::jsonb)",
    [eventName, actorUserId, organizationId, JSON.stringify(payload)],
  );
}

export async function upsertCapabilityClaim(input: { organizationId: string; actorUserId: string; id?: string; name: string; description: string }) {
  return withTransaction(async (client) => {
    let row;
    if (input.id) {
      const result = await client.query<{ id: string }>(
        `UPDATE organization_capability_claims SET name = $1, description = $2, updated_at = now()
         WHERE id = $3::uuid AND organization_id = $4::uuid AND claim_status <> 'archived' RETURNING id`,
        [input.name, input.description, input.id, input.organizationId],
      );
      if (!result.rowCount) throw new CapabilityServiceError(404, "Capability claim not found.");
      row = result.rows[0];
    } else {
      const result = await client.query<{ id: string }>(
        `INSERT INTO organization_capability_claims (organization_id, name, description)
         VALUES ($1::uuid, $2, $3) RETURNING id`,
        [input.organizationId, input.name, input.description],
      );
      row = result.rows[0];
    }
    await recordActivity(client, input.id ? "CapabilityClaimUpdated" : "CapabilityClaimCreated", input.actorUserId, input.organizationId, { capabilityClaimId: row.id });
    return row;
  });
}

export async function saveCapabilitySolution(input: { organizationId: string; actorUserId: string; claimId: string; solution: string }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE organization_capability_claims SET solution = $1, updated_at = now()
       WHERE id = $2::uuid AND organization_id = $3::uuid AND claim_status <> 'archived' RETURNING id`,
      [input.solution, input.claimId, input.organizationId],
    );
    if (!result.rowCount) throw new CapabilityServiceError(404, "Capability claim not found.");
    await recordActivity(client, "CapabilitySolutionUpdated", input.actorUserId, input.organizationId, { capabilityClaimId: input.claimId });
  });
}

export async function archiveCapabilityClaim(input: { organizationId: string; actorUserId: string; claimId: string }) {
  return withTransaction(async (client) => {
    const result = await client.query(
      `UPDATE organization_capability_claims SET claim_status = 'archived', updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid AND claim_status <> 'archived' RETURNING id`,
      [input.claimId, input.organizationId],
    );
    if (!result.rowCount) throw new CapabilityServiceError(404, "Capability claim not found.");
    await recordActivity(client, "CapabilityClaimArchived", input.actorUserId, input.organizationId, { capabilityClaimId: input.claimId });
  });
}

export async function acceptAmacsMapping(input: { organizationId: string; actorUserId: string; claimId: string; releaseId: string; conceptId: string }) {
  return withTransaction(async (client) => {
    const concept = await client.query(
      `SELECT 1 FROM amacs_runtime_concepts c JOIN amacs_runtime_releases r ON r.id = c.release_id
       WHERE c.release_id = $1::uuid AND c.concept_id = $2 AND c.matchable = true AND c.status = 'active' AND r.active = true`,
      [input.releaseId, input.conceptId],
    );
    if (!concept.rowCount) throw new CapabilityServiceError(400, "The selected AMACS concept is not an active matchable concept in the deployed release.");
    const updated = await client.query(
      `UPDATE organization_capability_claims
       SET amacs_release_id = $1::uuid, amacs_concept_id = $2, mapping_status = 'accepted', updated_at = now()
       WHERE id = $3::uuid AND organization_id = $4::uuid AND claim_status <> 'archived' RETURNING id`,
      [input.releaseId, input.conceptId, input.claimId, input.organizationId],
    );
    if (!updated.rowCount) throw new CapabilityServiceError(404, "Capability claim not found.");
    await recordActivity(client, "CapabilityAmacsMappingAccepted", input.actorUserId, input.organizationId, { capabilityClaimId: input.claimId, releaseId: input.releaseId, conceptId: input.conceptId });
  });
}

export async function addCapabilityEvidence(input: { organizationId: string; actorUserId: string; claimId: string; kind: CapabilityEvidenceKind; label: string; issuer?: string; sourceUrl?: string; notes?: string }) {
  return withTransaction(async (client) => {
    const claim = await client.query("SELECT 1 FROM organization_capability_claims WHERE id = $1::uuid AND organization_id = $2::uuid AND claim_status <> 'archived'", [input.claimId, input.organizationId]);
    if (!claim.rowCount) throw new CapabilityServiceError(404, "Capability claim not found.");
    const result = await client.query<{ id: string }>(
      `INSERT INTO organization_capability_evidence (capability_claim_id, kind, label, issuer, source_url, notes)
       VALUES ($1::uuid, $2, $3, $4, $5, $6) RETURNING id`,
      [input.claimId, input.kind, input.label, input.issuer ?? null, input.sourceUrl ?? null, input.notes ?? null],
    );
    await recordActivity(client, "CapabilityEvidenceAdded", input.actorUserId, input.organizationId, { capabilityClaimId: input.claimId, evidenceId: result.rows[0].id, kind: input.kind });
    return result.rows[0];
  });
}

export async function deleteCapabilityEvidence(input: { organizationId: string; actorUserId: string; evidenceId: string }) {
  return withTransaction(async (client) => {
    const result = await client.query<{ capability_claim_id: string }>(
      `DELETE FROM organization_capability_evidence e USING organization_capability_claims c
       WHERE e.id = $1::uuid AND e.capability_claim_id = c.id AND c.organization_id = $2::uuid
       RETURNING e.capability_claim_id`,
      [input.evidenceId, input.organizationId],
    );
    if (!result.rowCount) throw new CapabilityServiceError(404, "Evidence record not found.");
    await recordActivity(client, "CapabilityEvidenceRemoved", input.actorUserId, input.organizationId, { capabilityClaimId: result.rows[0].capability_claim_id, evidenceId: input.evidenceId });
  });
}

export async function saveCapabilityTerms(input: { organizationId: string; actorUserId: string; field: "tags" | "keywords" | "specialties"; values: string[] }) {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO organization_capability_profiles (organization_id, ${input.field}) VALUES ($1::uuid, $2::text[])
       ON CONFLICT (organization_id) DO UPDATE SET ${input.field} = EXCLUDED.${input.field}, updated_at = now()`,
      [input.organizationId, input.values],
    );
    await recordActivity(client, "CapabilityDiscoverabilityUpdated", input.actorUserId, input.organizationId, { field: input.field, count: input.values.length });
  });
}

export async function saveCapabilityProgress(input: { organizationId: string; actorUserId: string; path: string[]; completedLeafPath?: string }) {
  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO onboarding_capability_progress (organization_id, last_path, completed_leaf_paths)
       VALUES ($1::uuid, $2::text[], CASE WHEN $3::text IS NULL THEN '{}'::text[] ELSE ARRAY[$3::text] END)
       ON CONFLICT (organization_id) DO UPDATE SET
         last_path = EXCLUDED.last_path,
         completed_leaf_paths = CASE WHEN $3::text IS NULL OR $3::text = ANY(onboarding_capability_progress.completed_leaf_paths)
           THEN onboarding_capability_progress.completed_leaf_paths
           ELSE array_append(onboarding_capability_progress.completed_leaf_paths, $3::text) END,
         updated_at = now()`,
      [input.organizationId, input.path, input.completedLeafPath ?? null],
    );
    await recordActivity(client, "CapabilityEnrichmentProgressSaved", input.actorUserId, input.organizationId, { path: input.path, completedLeafPath: input.completedLeafPath });
  });
}

export async function searchActiveAmacsConcepts(search: string): Promise<AmacsCandidate[]> {
  const q = search.trim();
  if (q.length < 2) return [];
  const pattern = `%${q}%`;
  const result = await query<{
    release_id: string; release_version: string; source_commit_sha: string; concept_id: string; preferred_label: string; definition: string; primary_parent_id: string | null; matched_alias: string | null;
  }>(
    `SELECT c.release_id, r.version AS release_version, r.source_commit_sha, c.concept_id, c.preferred_label, c.definition, c.primary_parent_id,
            (SELECT a.alias FROM amacs_runtime_aliases a
             WHERE a.release_id = c.release_id AND a.concept_id = c.concept_id AND a.status = 'active' AND a.alias ILIKE $1
             ORDER BY CASE WHEN lower(a.alias) = lower($2) THEN 0 ELSE 1 END, length(a.alias) LIMIT 1) AS matched_alias
     FROM amacs_runtime_concepts c
     JOIN amacs_runtime_releases r ON r.id = c.release_id AND r.active = true
     WHERE c.matchable = true AND c.status = 'active'
       AND (c.preferred_label ILIKE $1 OR c.definition ILIKE $1 OR EXISTS (
         SELECT 1 FROM amacs_runtime_aliases a WHERE a.release_id = c.release_id AND a.concept_id = c.concept_id AND a.status = 'active' AND a.alias ILIKE $1
       ))
     ORDER BY CASE WHEN lower(c.preferred_label) = lower($2) THEN 0 WHEN c.preferred_label ILIKE $2 || '%' THEN 1 ELSE 2 END, c.preferred_label
     LIMIT 20`,
    [pattern, q],
  );
  return result.rows.map((row) => ({
    releaseId: row.release_id,
    releaseVersion: row.release_version,
    conceptId: row.concept_id,
    label: row.preferred_label,
    definition: row.definition,
    parentId: row.primary_parent_id ?? undefined,
    matchedAlias: row.matched_alias ?? undefined,
    sourceCommitSha: row.source_commit_sha.trim(),
  }));
}
