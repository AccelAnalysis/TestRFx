import { createHash, randomUUID } from "node:crypto";
import { getDatabase } from "@/lib/server/database";
import type { ExchangeRecord } from "@/lib/exchange/contracts";
import { normalizeProviderCandidate, type ExternalSourceDescriptor, type NormalizedProviderCandidate, type ProviderSourceCandidate } from "@/lib/resources/provider-ingestion";
import type { ResourceProviderExchangeRecord } from "@/lib/resources/provider-listing";

export class ProviderIngestionError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "provider_ingestion_error") {
    super(message);
    this.name = "ProviderIngestionError";
  }
}

// postgres.js exposes root Sql and transaction Sql as separate TypeScript
// interfaces even though both provide the tagged-template + json surface used
// by these helpers. Keep the helper boundary deliberately structural.
type QueryExecutor = any;

type DuplicateMatch = { organizationId?: string; score: number; basis: string; state: "ready" | "review_duplicate" | "duplicate_exact" };

function slugFor(name: string) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 52) || "resource-provider";
  return `${base}-${randomUUID().slice(0, 8)}`;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? {}));
}

function jsonHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value ?? {})).digest("hex");
}

async function ensureSource(sql: QueryExecutor, source: ExternalSourceDescriptor) {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO external_resource_sources (source_key, name, authority, source_url, license_or_use_basis, updated_at)
    VALUES (${source.key}, ${source.name}, ${source.authority}, ${source.sourceUrl ?? null}, ${source.licenseOrUseBasis}, now())
    ON CONFLICT (source_key) DO UPDATE SET
      name = EXCLUDED.name,
      authority = EXCLUDED.authority,
      source_url = EXCLUDED.source_url,
      license_or_use_basis = EXCLUDED.license_or_use_basis,
      updated_at = now()
    RETURNING id::text
  `;
  if (!rows[0]) throw new ProviderIngestionError("External source could not be established.", 500, "source_unavailable");
  return rows[0].id;
}

async function findDuplicate(sql: QueryExecutor, candidate: NormalizedProviderCandidate): Promise<DuplicateMatch> {
  if (candidate.normalizedDomain) {
    const exact = await sql<{ organization_id: string }[]>`
      SELECT organization_id::text
      FROM organization_identity
      WHERE lower(primary_domain) = ${candidate.normalizedDomain}
      LIMIT 1
    `;
    if (exact[0]) return { organizationId: exact[0].organization_id, score: 1, basis: "Exact primary-domain match", state: "duplicate_exact" };
  }

  const rows = await sql<{ organization_id: string; name_score: number | string; locality_match: boolean }[]>`
    SELECT
      o.id::text AS organization_id,
      similarity(lower(o.name), lower(${candidate.organizationName})) AS name_score,
      COALESCE(lower(loc.address->>'city') = lower(${candidate.locality ?? ""}), false) AS locality_match
    FROM organizations o
    LEFT JOIN LATERAL (
      SELECT address FROM locations WHERE organization_id = o.id ORDER BY created_at ASC LIMIT 1
    ) loc ON true
    WHERE similarity(lower(o.name), lower(${candidate.organizationName})) >= 0.55
    ORDER BY name_score DESC
    LIMIT 3
  `;
  const best = rows[0];
  if (!best) return { score: 0, basis: "No canonical organization match", state: "ready" };
  const nameScore = Number(best.name_score);
  const score = Math.min(0.99, nameScore + (best.locality_match ? 0.08 : 0));
  if (score >= 0.92) return { organizationId: best.organization_id, score, basis: best.locality_match ? "High-confidence name + locality match" : "High-confidence name match", state: "duplicate_exact" };
  if (score >= 0.72) return { organizationId: best.organization_id, score, basis: best.locality_match ? "Possible name + locality duplicate" : "Possible organization-name duplicate", state: "review_duplicate" };
  return { score, basis: "Similarity below duplicate-review threshold", state: "ready" };
}

export async function stageProviderCandidates(input: {
  source: ExternalSourceDescriptor;
  marketKey: string;
  candidates: ProviderSourceCandidate[];
}) {
  if (!input.candidates.length) throw new ProviderIngestionError("At least one provider candidate is required.");
  if (input.candidates.length > 500) throw new ProviderIngestionError("A single staging request may contain at most 500 candidates.", 413, "batch_too_large");
  const sql = getDatabase();

  return sql.begin(async (tx) => {
    const sourceId = await ensureSource(tx, input.source);
    const runRows = await tx<{ id: string }[]>`
      INSERT INTO resource_ingestion_runs (source_id, market_key, status, received_count)
      VALUES (${sourceId}::uuid, ${input.marketKey}, 'staging', ${input.candidates.length})
      RETURNING id::text
    `;
    const runId = runRows[0]?.id;
    if (!runId) throw new ProviderIngestionError("Ingestion run could not be created.", 500, "run_unavailable");

    const staged: { candidateId: string; state: string; matchedOrganizationId?: string; dedupeScore: number; dedupeBasis: string }[] = [];
    for (const rawCandidate of input.candidates) {
      const candidate = normalizeProviderCandidate(rawCandidate, input.marketKey);
      const duplicate = await findDuplicate(tx, candidate);
      const state = candidate.requiresClassificationReview ? "staged" : duplicate.state;
      const rows = await tx<{ id: string }[]>`
        INSERT INTO resource_ingestion_candidates (
          ingestion_run_id, source_id, source_record_id, source_record_url, market_key,
          organization_name, normalized_name, website, primary_domain,
          provider_type, provider_class, participation_policy, classification_basis, requires_classification_review,
          resource_category, service_name, service_summary,
          address_line_1, locality, region, postal_code, latitude, longitude, phone, contact_email, service_area,
          raw_payload, candidate_state, matched_organization_id, dedupe_score, dedupe_basis, updated_at
        ) VALUES (
          ${runId}::uuid, ${sourceId}::uuid, ${candidate.sourceRecordId}, ${candidate.sourceUrl ?? null}, ${candidate.marketKey},
          ${candidate.organizationName}, ${candidate.normalizedName}, ${candidate.website ?? null}, ${candidate.primaryDomain ?? null},
          ${candidate.providerType}, ${candidate.providerClass}, ${candidate.participationPolicy}, ${candidate.classificationBasis}, ${candidate.requiresClassificationReview},
          ${candidate.resourceCategory}, ${candidate.serviceName}, ${candidate.serviceSummary},
          ${candidate.addressLine1 ?? null}, ${candidate.locality ?? null}, ${candidate.region ?? null}, ${candidate.postalCode ?? null}, ${candidate.latitude ?? null}, ${candidate.longitude ?? null}, ${candidate.phone ?? null}, ${candidate.contactEmail ?? null}, ${candidate.serviceArea ?? null},
          ${tx.json(jsonSafe(candidate.raw))}, ${state}, ${duplicate.organizationId ?? null}::uuid, ${duplicate.score}, ${duplicate.basis}, now()
        )
        ON CONFLICT (source_id, source_record_id) DO UPDATE SET
          ingestion_run_id = EXCLUDED.ingestion_run_id,
          source_record_url = EXCLUDED.source_record_url,
          market_key = EXCLUDED.market_key,
          organization_name = EXCLUDED.organization_name,
          normalized_name = EXCLUDED.normalized_name,
          website = EXCLUDED.website,
          primary_domain = EXCLUDED.primary_domain,
          provider_type = EXCLUDED.provider_type,
          provider_class = EXCLUDED.provider_class,
          participation_policy = EXCLUDED.participation_policy,
          classification_basis = EXCLUDED.classification_basis,
          requires_classification_review = EXCLUDED.requires_classification_review,
          resource_category = EXCLUDED.resource_category,
          service_name = EXCLUDED.service_name,
          service_summary = EXCLUDED.service_summary,
          address_line_1 = EXCLUDED.address_line_1,
          locality = EXCLUDED.locality,
          region = EXCLUDED.region,
          postal_code = EXCLUDED.postal_code,
          latitude = EXCLUDED.latitude,
          longitude = EXCLUDED.longitude,
          phone = EXCLUDED.phone,
          contact_email = EXCLUDED.contact_email,
          service_area = EXCLUDED.service_area,
          raw_payload = EXCLUDED.raw_payload,
          candidate_state = EXCLUDED.candidate_state,
          matched_organization_id = EXCLUDED.matched_organization_id,
          dedupe_score = EXCLUDED.dedupe_score,
          dedupe_basis = EXCLUDED.dedupe_basis,
          updated_at = now()
        RETURNING id::text
      `;
      if (!rows[0]) throw new ProviderIngestionError("Provider candidate could not be staged.", 500, "candidate_unavailable");
      staged.push({ candidateId: rows[0].id, state, matchedOrganizationId: duplicate.organizationId, dedupeScore: duplicate.score, dedupeBasis: duplicate.basis });
    }

    const ready = staged.filter((candidate) => candidate.state === "ready").length;
    const duplicate = staged.filter((candidate) => candidate.state === "duplicate_exact").length;
    const review = staged.length - ready - duplicate;
    await tx`
      UPDATE resource_ingestion_runs
      SET status = 'review', ready_count = ${ready}, duplicate_count = ${duplicate}, review_count = ${review}
      WHERE id = ${runId}::uuid
    `;
    return { runId, received: staged.length, ready, duplicate, review, candidates: staged };
  });
}

type CandidateRow = {
  id: string; source_id: string; source_record_id: string; source_record_url: string | null; market_key: string;
  organization_name: string; website: string | null; primary_domain: string | null; provider_type: string;
  provider_class: "community_institutional" | "commercial"; participation_policy: "free_standard" | "commercial_paid";
  classification_basis: string; requires_classification_review: boolean; resource_category: string; service_name: string; service_summary: string;
  address_line_1: string | null; locality: string | null; region: string | null; postal_code: string | null;
  latitude: number | null; longitude: number | null; phone: string | null; contact_email: string | null; service_area: string | null;
  raw_payload: Record<string, unknown>; candidate_state: string; matched_organization_id: string | null; source_name: string; source_key: string; source_authority: "authoritative" | "licensed" | "curated";
};

async function candidateById(sql: QueryExecutor, candidateId: string) {
  const rows = await sql<CandidateRow[]>`
    SELECT c.*, s.name AS source_name, s.source_key, s.authority AS source_authority
    FROM resource_ingestion_candidates c
    JOIN external_resource_sources s ON s.id = c.source_id
    WHERE c.id = ${candidateId}::uuid
    LIMIT 1
  `;
  return rows[0];
}

export async function promoteProviderCandidate(input: { candidateId: string; canonicalOrganizationId?: string }) {
  const sql = getDatabase();
  return sql.begin(async (tx) => {
    const candidate = await candidateById(tx, input.candidateId);
    if (!candidate) throw new ProviderIngestionError("Provider candidate was not found.", 404, "candidate_not_found");
    if (candidate.candidate_state === "promoted") throw new ProviderIngestionError("Provider candidate has already been promoted.", 409, "already_promoted");
    if (candidate.requires_classification_review) throw new ProviderIngestionError("Provider classification requires documented review before promotion.", 409, "classification_review_required");
    if (candidate.candidate_state === "review_duplicate" && !input.canonicalOrganizationId) {
      throw new ProviderIngestionError("Possible duplicate requires an explicit canonical organization decision before promotion.", 409, "duplicate_review_required");
    }

    let organizationId = input.canonicalOrganizationId ?? candidate.matched_organization_id ?? undefined;
    if (!organizationId) {
      const organizationRows = await tx<{ id: string }[]>`
        INSERT INTO organizations (name, slug)
        VALUES (${candidate.organization_name}, ${slugFor(candidate.organization_name)})
        RETURNING id::text
      `;
      organizationId = organizationRows[0]?.id;
      if (!organizationId) throw new ProviderIngestionError("Canonical organization could not be created.", 500, "organization_unavailable");
      await tx`
        INSERT INTO organization_identity (organization_id, organization_type, website, primary_domain, claim_state, created_source)
        VALUES (${organizationId}::uuid, 'Resource Provider', ${candidate.website}, ${candidate.primary_domain}, 'unclaimed', ${`resource_seed:${candidate.source_key}`})
        ON CONFLICT (organization_id) DO NOTHING
      `;
    }

    await tx`
      INSERT INTO resource_provider_profiles (organization_id, provider_type, provider_class, participation_policy, classification_basis, market_key, seeded_at, updated_at)
      VALUES (${organizationId}::uuid, ${candidate.provider_type}, ${candidate.provider_class}, ${candidate.participation_policy}, ${candidate.classification_basis}, ${candidate.market_key}, now(), now())
      ON CONFLICT (organization_id) DO UPDATE SET
        provider_type = EXCLUDED.provider_type,
        provider_class = EXCLUDED.provider_class,
        participation_policy = EXCLUDED.participation_policy,
        classification_basis = EXCLUDED.classification_basis,
        market_key = EXCLUDED.market_key,
        seeded_at = COALESCE(resource_provider_profiles.seeded_at, now()),
        updated_at = now()
    `;

    let locationId: string | undefined;
    if (candidate.address_line_1 || candidate.locality || candidate.region || (candidate.latitude !== null && candidate.longitude !== null)) {
      const address = { line1: candidate.address_line_1, city: candidate.locality, region: candidate.region, postalCode: candidate.postal_code };
      const locationRows = candidate.latitude !== null && candidate.longitude !== null
        ? await tx<{ id: string }[]>`
            INSERT INTO locations (organization_id, label, address, point)
            VALUES (${organizationId}::uuid, 'Seeded provider location', ${tx.json(jsonSafe(address))}, ST_SetSRID(ST_MakePoint(${candidate.longitude}, ${candidate.latitude}), 4326)::geography)
            RETURNING id::text
          `
        : await tx<{ id: string }[]>`
            INSERT INTO locations (organization_id, label, address)
            VALUES (${organizationId}::uuid, 'Seeded provider location', ${tx.json(jsonSafe(address))})
            RETURNING id::text
          `;
      locationId = locationRows[0]?.id;
    }

    const publicId = `resource-seed-${randomUUID()}`;
    const exchangeRows = await tx<{ id: string }[]>`
      INSERT INTO exchange_records (public_id, record_type, organization_id, location_id, title, summary, status, metadata)
      VALUES (
        ${publicId}, 'resource', ${organizationId}::uuid, ${locationId ?? null}::uuid,
        ${candidate.service_name}, ${candidate.service_summary}, 'active',
        ${tx.json(jsonSafe({ seeded: true, source: candidate.source_name, providerType: candidate.provider_type, providerClass: candidate.provider_class, claimState: "unclaimed", marketKey: candidate.market_key }))}
      )
      RETURNING id::text
    `;
    const exchangeRecordId = exchangeRows[0]?.id;
    if (!exchangeRecordId) throw new ProviderIngestionError("Resource Exchange record could not be created.", 500, "exchange_record_unavailable");

    await tx`
      INSERT INTO resources (exchange_record_id, resource_mode, category, availability, capacity, visibility, terms)
      VALUES (
        ${exchangeRecordId}::uuid, 'offer', ${candidate.resource_category},
        ${tx.json(jsonSafe({ state: "unknown", label: "Provider confirmation required", serviceArea: candidate.service_area }))},
        ${tx.json(jsonSafe({}))},
        ${locationId ? "public-location" : candidate.service_area ? "service-area" : "off-map"},
        ${tx.json(jsonSafe({ sourced: true }))}
      )
    `;

    await tx`
      INSERT INTO external_resource_source_records (source_id, source_record_id, organization_id, exchange_record_id, source_url, raw_payload_hash, source_snapshot)
      VALUES (${candidate.source_id}::uuid, ${candidate.source_record_id}, ${organizationId}::uuid, ${exchangeRecordId}::uuid, ${candidate.source_record_url}, ${jsonHash(candidate.raw_payload)}, ${tx.json(jsonSafe(candidate.raw_payload))})
      ON CONFLICT (source_id, source_record_id) DO UPDATE SET
        organization_id = EXCLUDED.organization_id,
        exchange_record_id = EXCLUDED.exchange_record_id,
        source_url = EXCLUDED.source_url,
        raw_payload_hash = EXCLUDED.raw_payload_hash,
        source_snapshot = EXCLUDED.source_snapshot,
        last_checked_at = now()
    `;

    await tx`
      UPDATE resource_ingestion_candidates
      SET candidate_state = 'promoted', promoted_organization_id = ${organizationId}::uuid, promoted_exchange_record_id = ${exchangeRecordId}::uuid, promoted_at = now(), updated_at = now()
      WHERE id = ${candidate.id}::uuid
    `;

    return { candidateId: candidate.id, organizationId, exchangeRecordId, claimState: "unclaimed" as const };
  });
}

export async function listSeededResourceProviderRecords(): Promise<ExchangeRecord[]> {
  const sql = getDatabase();
  const rows = await sql<{
    public_id: string; organization_id: string; organization_name: string; title: string; summary: string; status: string; metadata: Record<string, unknown>;
    category: string | null; availability: Record<string, unknown>; visibility: string; terms: Record<string, unknown>;
    provider_type: string; provider_class: "community_institutional" | "commercial"; participation_policy: "free_standard" | "commercial_paid"; classification_basis: string; market_key: string | null;
    claim_state: "unclaimed" | "claimed" | "verified"; latitude: number | null; longitude: number | null; city: string | null; region: string | null;
    source_key: string | null; source_name: string | null; source_url: string | null; source_authority: "authoritative" | "licensed" | "curated" | null; last_checked_at: Date | null;
  }[]>`
    SELECT
      er.public_id, o.id::text AS organization_id, o.name AS organization_name, er.title, er.summary, er.status, er.metadata,
      r.category, r.availability, r.visibility, r.terms,
      rp.provider_type, rp.provider_class, rp.participation_policy, rp.classification_basis, rp.market_key,
      COALESCE(oi.claim_state, 'unclaimed') AS claim_state,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS latitude,
      CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS longitude,
      l.address->>'city' AS city,
      COALESCE(l.address->>'region', l.address->>'state') AS region,
      provenance.source_key, provenance.source_name, provenance.source_url, provenance.source_authority, provenance.last_checked_at
    FROM exchange_records er
    JOIN organizations o ON o.id = er.organization_id
    JOIN resources r ON r.exchange_record_id = er.id
    JOIN resource_provider_profiles rp ON rp.organization_id = o.id
    LEFT JOIN organization_identity oi ON oi.organization_id = o.id
    LEFT JOIN locations l ON l.id = er.location_id
    LEFT JOIN LATERAL (
      SELECT s.source_key, s.name AS source_name, sr.source_url, s.authority AS source_authority, sr.last_checked_at
      FROM external_resource_source_records sr
      JOIN external_resource_sources s ON s.id = sr.source_id
      WHERE sr.exchange_record_id = er.id
      ORDER BY sr.last_checked_at DESC
      LIMIT 1
    ) provenance ON true
    WHERE er.record_type = 'resource' AND er.status = 'active' AND r.archived_at IS NULL
    ORDER BY er.updated_at DESC
  `;

  return rows.map((row): ResourceProviderExchangeRecord => {
    const availabilityState = typeof row.availability?.state === "string" ? row.availability.state : "unknown";
    const availabilityLabel = typeof row.availability?.label === "string" ? row.availability.label : "Provider confirmation required";
    const serviceArea = typeof row.availability?.serviceArea === "string" ? row.availability.serviceArea : undefined;
    const geography = [row.city, row.region].filter(Boolean).join(", ") || serviceArea || "Service area not published";
    return {
      id: row.public_id,
      type: "resource",
      title: row.title,
      organization: row.organization_name,
      summary: row.summary,
      geography,
      metadata: [row.category ?? "Resource", row.claim_state === "unclaimed" ? "Unclaimed listing" : row.claim_state, row.provider_class === "community_institutional" ? "Community / Institutional" : "Commercial Provider"],
      location: row.latitude !== null && row.longitude !== null ? { lat: Number(row.latitude), lng: Number(row.longitude) } : undefined,
      card: {
        eyebrow: row.provider_class === "community_institutional" ? "Community Resource Provider" : "Commercial Resource Provider",
        classifications: [row.category ?? "Resource", row.provider_type],
        status: { label: row.claim_state === "unclaimed" ? "Unclaimed" : row.claim_state === "verified" ? "Verified" : "Claimed", tone: row.claim_state === "verified" ? "success" : "neutral" },
      },
      resource: {
        category: row.category ?? "Resource",
        availability: availabilityState === "available" || availabilityState === "limited" || availabilityState === "scheduled" ? availabilityState : "unknown",
        availabilityLabel,
        serviceArea,
        visibility: row.visibility === "public-location" || row.visibility === "service-area" || row.visibility === "off-map" ? row.visibility : "off-map",
        terms: typeof row.terms?.note === "string" ? row.terms.note : undefined,
        status: "active",
      },
      resourceProvider: {
        organizationId: row.organization_id,
        providerType: row.provider_type,
        providerClass: row.provider_class,
        participationPolicy: row.participation_policy,
        claimState: row.claim_state,
        classificationBasis: row.classification_basis,
        marketKey: row.market_key ?? undefined,
        source: {
          sourceKey: row.source_key ?? "unknown-source",
          sourceName: row.source_name ?? "Source provenance unavailable",
          sourceUrl: row.source_url ?? undefined,
          authority: row.source_authority ?? "curated",
          lastCheckedAt: row.last_checked_at?.toISOString(),
        },
      },
    };
  });
}
