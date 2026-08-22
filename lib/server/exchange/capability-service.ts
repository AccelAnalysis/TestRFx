import { randomUUID } from "node:crypto";
import type { CapabilityOrganizationProfile, CapabilityClaim, CapabilityEvidenceItem, CapabilityGap } from "@/lib/capabilities/contracts";
import { capabilityProfileToExchangeRecord } from "@/lib/capabilities/contracts";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { organizationCardMedia } from "@/lib/server/exchange/organization-card-media";
import { assertExchangeWrite, type ExchangeServerActor } from "@/lib/server/exchange/actor";
import { getDatabase } from "@/lib/server/database";

export class CapabilityExchangeServiceError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "CapabilityExchangeServiceError";
  }
}

type OrganizationRow = {
  organization_id: string;
  organization_name: string;
  exchange_record_id: string | null;
  exchange_record_uuid: string | null;
  publication_status: "draft" | "published" | null;
  summary: string | null;
  keywords: string[] | null;
  specialties: string[] | null;
  service_offerings: string[] | null;
  geography: string | null;
  location_visibility: "exact" | "approximate" | "locality_only" | null;
  lat: number | string | null;
  lng: number | string | null;
  centroid_lat: number | string | null;
  centroid_lng: number | string | null;
  searchable: boolean;
  map_visible: boolean;
  logo_url: string | null;
  media_source_type: "linked" | "uploaded" | null;
  media_provider: "youtube" | "vimeo" | "rfxchange" | null;
  media_provider_video_id: string | null;
  media_poster_url: string | null;
  media_playback_url: string | null;
  media_status: "pending" | "ready" | "rejected" | null;
  saved: boolean;
  following: boolean;
};

type ClaimRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  solution: string | null;
  mapping_status: "unmapped" | "accepted";
  claim_status: "draft" | "active" | "archived";
  amacs_concept_id: string | null;
  amacs_label: string | null;
};

type EvidenceRow = {
  id: string;
  organization_id: string;
  capability_claim_id: string;
  kind: "certification" | "license" | "case-study" | "supporting-document";
  label: string;
  issuer: string | null;
  notes: string | null;
};

function numberOrUndefined(value: number | string | null) {
  if (value === null) return undefined;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function locationFor(row: OrganizationRow) {
  if (!row.map_visible) return undefined;
  const exactLat = numberOrUndefined(row.lat);
  const exactLng = numberOrUndefined(row.lng);
  if (row.location_visibility === "exact" && exactLat !== undefined && exactLng !== undefined) return { lat: exactLat, lng: exactLng };
  const centroidLat = numberOrUndefined(row.centroid_lat);
  const centroidLng = numberOrUndefined(row.centroid_lng);
  if (centroidLat !== undefined && centroidLng !== undefined) return { lat: centroidLat, lng: centroidLng };
  return undefined;
}

function evidenceKind(kind: EvidenceRow["kind"]): CapabilityEvidenceItem["kind"] {
  return kind === "supporting-document" ? "document" : kind;
}

function deriveGaps(claims: CapabilityClaim[], keywords: string[], specialties: string[]): CapabilityGap[] {
  const gaps: CapabilityGap[] = [];
  const unmapped = claims.filter((claim) => claim.mappingStatus !== "accepted");
  if (unmapped.length) gaps.push({
    id: "amacs-alignment",
    label: "AMACS alignment",
    reason: `${unmapped.length} capability claim${unmapped.length === 1 ? " is" : "s are"} not yet accepted against the governed AMACS release.`,
    suggestedSearch: unmapped[0]?.name ?? "AMACS mapping",
  });
  const unsupported = claims.filter((claim) => claim.evidence.length === 0);
  if (unsupported.length) gaps.push({
    id: "capability-evidence",
    label: "Capability evidence",
    reason: `${unsupported.length} capability claim${unsupported.length === 1 ? " has" : "s have"} no supporting evidence metadata yet.`,
    suggestedSearch: unsupported[0]?.name ?? "capability evidence",
  });
  if (!keywords.length && !specialties.length) gaps.push({
    id: "discoverability",
    label: "Discoverability terms",
    reason: "No keywords or specialties have been added to the capability profile.",
    suggestedSearch: claims[0]?.name ?? "capability",
  });
  return gaps;
}

function profileStrength(claims: CapabilityClaim[], keywords: string[], specialties: string[]) {
  if (!claims.length) return 0;
  const mapped = claims.filter((claim) => claim.mappingStatus === "accepted").length / claims.length;
  const evidenced = claims.filter((claim) => claim.evidence.length > 0).length / claims.length;
  const discoverability = keywords.length || specialties.length ? 1 : 0;
  return Math.round((0.45 * mapped + 0.4 * evidenced + 0.15 * discoverability) * 100);
}

async function organizationRows(actor: ExchangeServerActor) {
  const sql = getDatabase();
  return sql<OrganizationRow[]>`
    SELECT
      o.id::text AS organization_id,
      o.name AS organization_name,
      projection.public_id AS exchange_record_id,
      projection.exchange_record_uuid,
      projection.publication_status,
      NULLIF(btrim(op.description), '') AS summary,
      ocp.keywords,
      ocp.specialties,
      op.service_offerings,
      COALESCE(g.name, l.label) AS geography,
      l.visibility::text AS location_visibility,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_Y(g.centroid::geometry) END AS centroid_lat,
      CASE WHEN g.centroid IS NULL THEN NULL ELSE ST_X(g.centroid::geometry) END AS centroid_lng,
      COALESCE((op.visibility ->> 'searchable')::boolean, true) AS searchable,
      COALESCE((op.visibility ->> 'mapVisible')::boolean, true) AS map_visible,
      op.logo_url,
      om.source_type::text AS media_source_type,
      om.provider::text AS media_provider,
      om.provider_video_id AS media_provider_video_id,
      om.poster_url AS media_poster_url,
      om.playback_url AS media_playback_url,
      om.status::text AS media_status,
      CASE WHEN projection.exchange_record_uuid IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM record_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = projection.exchange_record_uuid::uuid
          AND rr.relationship_kind = 'saved'
      ) END AS saved,
      CASE WHEN projection.exchange_record_uuid IS NULL THEN false ELSE EXISTS (
        SELECT 1 FROM record_relationships rr
        WHERE rr.user_id = ${actor.userId}::uuid
          AND rr.exchange_record_id = projection.exchange_record_uuid::uuid
          AND rr.relationship_kind = 'following'
      ) END AS following
    FROM organizations o
    JOIN organization_capability_claims claim_presence
      ON claim_presence.organization_id = o.id AND claim_presence.claim_status <> 'archived'
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_capability_profiles ocp ON ocp.organization_id = o.id
    LEFT JOIN locations l ON l.organization_id = o.id AND l.is_primary = true
    LEFT JOIN geographies g ON g.id = l.geography_id
    LEFT JOIN organization_media om
      ON om.organization_id = o.id
     AND om.media_role = 'intro_video'
    LEFT JOIN LATERAL (
      SELECT er.public_id,
             er.id::text AS exchange_record_uuid,
             c.publication_status
      FROM exchange_records er
      JOIN capabilities c ON c.exchange_record_id = er.id
      WHERE er.organization_id = o.id
        AND er.record_type = 'capability'
        AND er.status = 'active'
      ORDER BY c.published_at DESC NULLS LAST, er.updated_at DESC
      LIMIT 1
    ) projection ON true
    WHERE o.id = ${actor.organizationId}::uuid
       OR (projection.publication_status = 'published' AND COALESCE((op.visibility ->> 'searchable')::boolean, true))
    GROUP BY o.id, o.name, projection.public_id, projection.exchange_record_uuid, projection.publication_status,
             op.description, ocp.keywords, ocp.specialties, op.service_offerings, g.name, l.label, l.visibility,
             l.point, g.centroid, op.visibility, op.logo_url, om.source_type, om.provider,
             om.provider_video_id, om.poster_url, om.playback_url, om.status
    ORDER BY CASE WHEN o.id = ${actor.organizationId}::uuid THEN 0 ELSE 1 END, o.name
  `;
}

async function claimsForOrganizations(organizationIds: string[]) {
  if (!organizationIds.length) return [] as ClaimRow[];
  const sql = getDatabase();
  return sql<ClaimRow[]>`
    SELECT c.id::text,
           c.organization_id::text,
           c.name,
           c.description,
           c.solution,
           c.mapping_status,
           c.claim_status,
           c.amacs_concept_id,
           ac.preferred_label AS amacs_label
    FROM organization_capability_claims c
    LEFT JOIN amacs_runtime_concepts ac
      ON ac.release_id = c.amacs_release_id AND ac.concept_id = c.amacs_concept_id
    WHERE c.organization_id = ANY(${organizationIds}::uuid[])
      AND c.claim_status <> 'archived'
    ORDER BY c.organization_id, c.created_at, c.id
  `;
}

async function evidenceForOrganizations(organizationIds: string[]) {
  if (!organizationIds.length) return [] as EvidenceRow[];
  const sql = getDatabase();
  return sql<EvidenceRow[]>`
    SELECT e.id::text,
           c.organization_id::text,
           e.capability_claim_id::text,
           e.kind,
           e.label,
           e.issuer,
           e.notes
    FROM organization_capability_evidence e
    JOIN organization_capability_claims c ON c.id = e.capability_claim_id
    WHERE c.organization_id = ANY(${organizationIds}::uuid[])
      AND c.claim_status <> 'archived'
    ORDER BY e.created_at, e.id
  `;
}

function profilesFromRows(actor: ExchangeServerActor, rows: OrganizationRow[], claimRows: ClaimRow[], evidenceRows: EvidenceRow[]) {
  const evidenceByClaim = new Map<string, CapabilityEvidenceItem[]>();
  for (const evidence of evidenceRows) {
    const list = evidenceByClaim.get(evidence.capability_claim_id) ?? [];
    list.push({ id: evidence.id, kind: evidenceKind(evidence.kind), label: evidence.label, issuer: evidence.issuer ?? undefined, note: evidence.notes ?? undefined });
    evidenceByClaim.set(evidence.capability_claim_id, list);
  }
  const claimsByOrganization = new Map<string, CapabilityClaim[]>();
  for (const claim of claimRows) {
    const list = claimsByOrganization.get(claim.organization_id) ?? [];
    const evidence = evidenceByClaim.get(claim.id) ?? [];
    list.push({
      id: claim.id,
      name: claim.name,
      description: claim.description,
      amacsNodeId: claim.amacs_concept_id ?? undefined,
      amacsLabel: claim.amacs_label ?? undefined,
      mappingStatus: claim.mapping_status === "accepted" ? "accepted" : "needs-review",
      publicationStatus: claim.claim_status === "active" ? "published" : "ready",
      evidenceState: evidence.length ? "supported" : "claimed",
      evidence,
      specialties: [],
    });
    claimsByOrganization.set(claim.organization_id, list);
  }

  return rows.map((row): CapabilityOrganizationProfile => {
    const claims = claimsByOrganization.get(row.organization_id) ?? [];
    const keywords = row.keywords ?? [];
    const specialties = row.specialties ?? [];
    const organizationMedia = organizationCardMedia({
      logo_url: row.logo_url ?? undefined,
      media_source_type: row.media_source_type ?? undefined,
      media_provider: row.media_provider ?? undefined,
      media_provider_video_id: row.media_provider_video_id ?? undefined,
      media_poster_url: row.media_poster_url ?? undefined,
      media_playback_url: row.media_playback_url ?? undefined,
      media_status: row.media_status ?? undefined,
    }, row.organization_name);
    return {
      exchangeRecordId: row.exchange_record_id ?? `cap-draft-${row.organization_id}`,
      organizationName: row.organization_name,
      summary: row.summary ?? claims[0]?.description ?? "Capability profile",
      geography: row.geography ?? "Service geography not published",
      serviceAreas: row.service_offerings ?? [],
      keywords,
      capabilities: claims.map((claim) => ({ ...claim, specialties })),
      profileStrength: profileStrength(claims, keywords, specialties),
      gaps: deriveGaps(claims, keywords, specialties),
      rfxMatches: [],
      location: locationFor(row),
      ownedByViewer: row.organization_id === actor.organizationId,
      saved: row.saved || row.following,
      organizationMedia,
    };
  });
}

export async function listCapabilityProfiles(actor: ExchangeServerActor) {
  const rows = await organizationRows(actor);
  const ids = rows.map((row) => row.organization_id);
  const [claims, evidence] = await Promise.all([claimsForOrganizations(ids), evidenceForOrganizations(ids)]);
  return profilesFromRows(actor, rows, claims, evidence);
}

export async function listCapabilityExchangeRecords(actor: ExchangeServerActor): Promise<ExchangeRecord[]> {
  return (await listCapabilityProfiles(actor)).map(capabilityProfileToExchangeRecord);
}

export async function publishCapabilityProfile(actor: ExchangeServerActor) {
  assertExchangeWrite(actor, "capabilities:write");
  const sql = getDatabase();
  const claimRows = await sql<{ id: string; name: string; description: string; amacs_concept_id: string | null }[]>`
    SELECT id::text, name, description, amacs_concept_id
    FROM organization_capability_claims
    WHERE organization_id = ${actor.organizationId}::uuid
      AND claim_status <> 'archived'
    ORDER BY created_at, id
  `;
  if (!claimRows.length) throw new CapabilityExchangeServiceError(409, "Add at least one capability claim before publishing the capability profile.");

  const profileRows = await sql<{ description: string | null; keywords: string[] | null; specialties: string[] | null }[]>`
    SELECT op.description, ocp.keywords, ocp.specialties
    FROM organizations o
    LEFT JOIN organization_profiles op ON op.organization_id = o.id
    LEFT JOIN organization_capability_profiles ocp ON ocp.organization_id = o.id
    WHERE o.id = ${actor.organizationId}::uuid
    LIMIT 1
  `;
  const profile = profileRows[0];
  const title = claimRows[0].name;
  const summary = profile?.description?.trim() || claimRows[0].description;
  const publicId = `cap-${randomUUID()}`;

  await sql.begin(async (tx) => {
    const existing = await tx<{ exchange_record_id: string; public_id: string }[]>`
      SELECT er.id::text AS exchange_record_id, er.public_id
      FROM exchange_records er
      JOIN capabilities c ON c.exchange_record_id = er.id
      WHERE er.organization_id = ${actor.organizationId}::uuid
        AND er.record_type = 'capability'
        AND er.status = 'active'
      ORDER BY er.updated_at DESC
      LIMIT 1
    `;

    let exchangeRecordId = existing[0]?.exchange_record_id;
    let resolvedPublicId = existing[0]?.public_id ?? publicId;
    if (!exchangeRecordId) {
      const created = await tx<{ id: string }[]>`
        INSERT INTO exchange_records (public_id, record_type, organization_id, title, summary, metadata, status)
        VALUES (
          ${resolvedPublicId}, 'capability', ${actor.organizationId}::uuid, ${title}, ${summary},
          ${tx.json({ keywords: profile?.keywords ?? [], specialties: profile?.specialties ?? [] })}, 'active'
        ) RETURNING id::text
      `;
      exchangeRecordId = created[0]?.id;
      if (!exchangeRecordId) throw new CapabilityExchangeServiceError(500, "Capability Exchange projection could not be created.");
      await tx`
        INSERT INTO capabilities (exchange_record_id, amacs_node_id, evidence_state, evidence, publication_status, published_at)
        VALUES (${exchangeRecordId}::uuid, ${claimRows.find((claim) => claim.amacs_concept_id)?.amacs_concept_id ?? null}, 'claimed', '[]'::jsonb, 'published', now())
      `;
    } else {
      await tx`
        UPDATE exchange_records
        SET title = ${title}, summary = ${summary}, metadata = ${tx.json({ keywords: profile?.keywords ?? [], specialties: profile?.specialties ?? [] })}, updated_at = now()
        WHERE id = ${exchangeRecordId}::uuid
      `;
      await tx`
        UPDATE capabilities
        SET amacs_node_id = ${claimRows.find((claim) => claim.amacs_concept_id)?.amacs_concept_id ?? null}, publication_status = 'published', published_at = now(), updated_at = now()
        WHERE exchange_record_id = ${exchangeRecordId}::uuid
      `;
    }

    await tx`
      UPDATE organization_capability_claims
      SET claim_status = 'active', updated_at = now()
      WHERE organization_id = ${actor.organizationId}::uuid
        AND claim_status = 'draft'
    `;

    const evidence = await tx<{ kind: string; label: string; issuer: string | null; source_url: string | null }[]>`
      SELECT e.kind, e.label, e.issuer, e.source_url
      FROM organization_capability_evidence e
      JOIN organization_capability_claims c ON c.id = e.capability_claim_id
      WHERE c.organization_id = ${actor.organizationId}::uuid
        AND c.claim_status <> 'archived'
      ORDER BY e.created_at
    `;
    await tx`
      UPDATE capabilities
      SET evidence_state = ${evidence.length ? "supported" : "claimed"},
          evidence = ${tx.json(evidence)},
          updated_at = now()
      WHERE exchange_record_id = ${exchangeRecordId}::uuid
    `;
    await tx`
      INSERT INTO activity_events (event_name, actor_user_id, organization_id, exchange_record_id, payload)
      VALUES ('CapabilityProfilePublished', ${actor.userId}::uuid, ${actor.organizationId}::uuid, ${exchangeRecordId}::uuid, ${tx.json({ publicId: resolvedPublicId, claimCount: claimRows.length, evidenceCount: evidence.length })})
    `;
  });

  const profiles = await listCapabilityProfiles(actor);
  const profileAfterPublish = profiles.find((item) => item.ownedByViewer);
  if (!profileAfterPublish) throw new CapabilityExchangeServiceError(500, "Published capability profile could not be reloaded.");
  return { profile: profileAfterPublish, record: capabilityProfileToExchangeRecord(profileAfterPublish) };
}
