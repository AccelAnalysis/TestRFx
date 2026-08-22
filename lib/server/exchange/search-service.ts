import type { ExchangeCardProjection, ExchangeLens, ExchangeRecord, ExchangeRecordType, ExchangeSearchResponse, ExchangeSearchState, ResourceProjection } from "@/lib/exchange/contracts";
import { normalizeSearchState } from "@/lib/exchange/search";
import { organizationCardMedia } from "@/lib/server/exchange/organization-card-media";
import type { ExchangeServerActor } from "@/lib/server/exchange/actor";
import { query } from "@/lib/server/postgres";

type SearchRow = {
  public_id: string;
  record_type: ExchangeRecordType;
  organization_id: string;
  organization_name: string;
  title: string;
  summary: string;
  geography: string | null;
  metadata: unknown;
  lat: number | string | null;
  lng: number | string | null;
  owned: boolean;
  saved: boolean;
  following: boolean;
  watching: boolean;
  tracking: boolean;
  sponsored: boolean;
  sponsor_label: string | null;
  score: number | string;
  total_count: number | string;
  mapped_count: number | string;
  updated_at: Date | string;
  rfx_type: string | null;
  rfx_status: string | null;
  rfx_due_at: Date | string | null;
  resource_category: string | null;
  resource_availability: "available" | "limited" | "scheduled" | null;
  resource_availability_label: string | null;
  resource_capacity: string | null;
  resource_service_area: string | null;
  resource_visibility: "public-location" | "service-area" | "off-map" | null;
  resource_terms: string | null;
  resource_status: "active" | "archived" | null;
  intelligence_signal: string | null;
  intelligence_source_type: string | null;
  capability_amacs: string | null;
  capability_evidence_state: string | null;
  capability_publication_status: string | null;
  logo_url: string | null;
  media_source_type: "linked" | "uploaded" | null;
  media_provider: "youtube" | "vimeo" | "rfxchange" | null;
  media_provider_video_id: string | null;
  media_poster_url: string | null;
  media_playback_url: string | null;
  media_status: "pending" | "ready" | "rejected" | null;
};

type FacetRow = { key: string; value: string; count: number | string };

function recordType(lens: ExchangeLens): ExchangeRecordType { return lens === "resources" ? "resource" : lens === "intelligence" ? "intelligence" : lens === "capabilities" ? "capability" : "rfx"; }
function cursorOffset(cursor?: string) { if (!cursor) return 0; try { const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { offset?: unknown }; return typeof value.offset === "number" && Number.isInteger(value.offset) && value.offset >= 0 ? value.offset : 0; } catch { return 0; } }
function encodeCursor(offset: number) { return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url"); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function isoDate(value: Date | string | null) { if (!value) return undefined; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? undefined : date.toISOString(); }

function toRecord(row: SearchRow): ExchangeRecord {
  const meta = object(row.metadata);
  const metadata = [...new Set([
    ...strings(meta.tags),
    ...strings(meta.classifications),
    ...strings(meta.keywords),
    row.rfx_type ?? undefined,
    row.resource_category ?? undefined,
    row.resource_availability_label ?? undefined,
    row.intelligence_signal ?? undefined,
    row.intelligence_source_type ?? undefined,
    row.capability_amacs ?? undefined,
    row.capability_evidence_state ?? undefined,
    row.sponsor_label ?? undefined,
  ].filter((item): item is string => Boolean(item)))];
  const relationships: NonNullable<ExchangeCardProjection["relationships"]> = [];
  if (row.saved) relationships.push("saved");
  if (row.following) relationships.push("following");
  if (row.watching || row.tracking) relationships.push("watched");
  if (row.owned) relationships.push("owned");
  const orgMedia = organizationCardMedia({
    logo_url: row.logo_url ?? undefined,
    media_source_type: row.media_source_type ?? undefined,
    media_provider: row.media_provider ?? undefined,
    media_provider_video_id: row.media_provider_video_id ?? undefined,
    media_poster_url: row.media_poster_url ?? undefined,
    media_playback_url: row.media_playback_url ?? undefined,
    media_status: row.media_status ?? undefined,
  }, row.organization_name);
  const resource: ResourceProjection | undefined = row.record_type === "resource" && row.resource_category && row.resource_availability && row.resource_availability_label && row.resource_visibility && row.resource_status ? {
    category: row.resource_category,
    availability: row.resource_availability,
    availabilityLabel: row.resource_availability_label,
    capacity: row.resource_capacity ?? undefined,
    serviceArea: row.resource_service_area ?? undefined,
    visibility: row.resource_visibility,
    terms: row.resource_terms ?? undefined,
    status: row.resource_status,
    sponsored: row.sponsored,
  } : undefined;
  const statusLabel = row.record_type === "resource" ? row.resource_availability_label : row.record_type === "rfx" ? row.rfx_status : row.record_type === "intelligence" ? (row.tracking || row.following ? "Tracking" : "Current") : row.capability_publication_status;
  const classifications = row.record_type === "resource" ? [row.resource_category] : row.record_type === "intelligence" ? [row.intelligence_signal] : row.record_type === "capability" ? [row.capability_amacs] : [row.rfx_type];
  return {
    id: row.public_id,
    type: row.record_type,
    title: row.title,
    organization: row.organization_name,
    summary: row.summary,
    geography: row.geography ?? "Geography not published",
    metadata,
    location: row.lat === null || row.lng === null ? undefined : { lat: Number(row.lat), lng: Number(row.lng) },
    ownedByViewer: row.owned,
    saved: row.saved || row.following || row.watching || row.tracking,
    featured: row.sponsored,
    card: {
      eyebrow: row.record_type === "rfx" ? row.rfx_type ?? "RFx" : row.record_type === "resource" ? "Resource" : row.record_type === "intelligence" ? row.intelligence_signal ?? "Intelligence" : "Organization capability profile",
      organizationMedia: orgMedia,
      classifications: classifications.filter((item): item is string => Boolean(item)),
      status: statusLabel ? { label: statusLabel, tone: row.record_type === "resource" && row.resource_availability === "available" ? "success" : "info" } : undefined,
      relationships,
      placement: row.sponsored ? "sponsored" : "organic",
    },
    resource,
  };
}

export async function searchExchange(input: { actor: ExchangeServerActor; lens: ExchangeLens; state: ExchangeSearchState; cursor?: string; limit?: number }): Promise<ExchangeSearchResponse> {
  const state = normalizeSearchState(input.state); const values: unknown[] = []; const p = (value: unknown) => { values.push(value); return `$${values.length}`; };
  const where = [`er.record_type = ${p(recordType(input.lens))}::exchange_record_type`, "er.status = 'active'"];
  if (input.lens === "resources") where.push("COALESCE(res.status, 'active') = 'active'");
  if (input.lens === "capabilities") where.push("COALESCE(cap.publication_status, 'draft') = 'published'");
  const text = state.query.trim(); let score = "0::float8";
  if (text) {
    const q = p(text); const like = p(`%${text}%`);
    where.push(`(er.search_document @@ websearch_to_tsquery('english', ${q}) OR er.public_id ILIKE ${like} OR er.title ILIKE ${like} OR er.summary ILIKE ${like} OR o.name ILIKE ${like} OR COALESCE(er.geography_label, g.name, l.label, '') ILIKE ${like} OR er.metadata::text ILIKE ${like} OR rr.solicitation_type ILIKE ${like} OR rr.requirements::text ILIKE ${like} OR req.label ILIKE ${like} OR req.metadata::text ILIKE ${like} OR res.category ILIKE ${like} OR res.availability_label ILIKE ${like} OR ir.signal_type ILIKE ${like} OR ir.provenance::text ILIKE ${like} OR src.source_label ILIKE ${like} OR cap.amacs_node_id ILIKE ${like} OR claim.name ILIKE ${like} OR claim.description ILIKE ${like} OR claim.amacs_concept_id ILIKE ${like})`);
    score = `(ts_rank_cd(er.search_document, websearch_to_tsquery('english', ${q})) + CASE WHEN er.public_id ILIKE ${like} THEN .8 ELSE 0 END + CASE WHEN er.title ILIKE ${like} THEN .5 ELSE 0 END + CASE WHEN o.name ILIKE ${like} THEN .3 ELSE 0 END)::float8`;
  }
  const f = state.filters; const mode = f.geographyMode ?? "exchange";
  if (f.geography.trim() && (mode === "exchange" || mode === "place")) where.push(`COALESCE(er.geography_label, g.name, l.label, l.address::text, '') ILIKE ${p(`%${f.geography.trim()}%`)}`);
  if (mode === "viewport" && f.bounds) { where.push(`search_point.point IS NOT NULL AND ST_Within(search_point.point, ST_MakeEnvelope(${p(f.bounds.west)}, ${p(f.bounds.south)}, ${p(f.bounds.east)}, ${p(f.bounds.north)}, 4326))`); }
  if (mode === "radius" && f.center && f.radiusMiles) where.push(`search_point.point IS NOT NULL AND ST_DWithin(search_point.point::geography, ST_SetSRID(ST_MakePoint(${p(f.center.lng)}, ${p(f.center.lat)}),4326)::geography, ${p(f.radiusMiles * 1609.344)})`);
  if (mode === "service-area" && f.center) where.push(`l.service_area IS NOT NULL AND ST_Covers(l.service_area, ST_SetSRID(ST_MakePoint(${p(f.center.lng)}, ${p(f.center.lat)}),4326))`);
  if (mode === "performance-area" && f.center && input.lens === "rfx") where.push(`rr.performance_area IS NOT NULL AND ST_Covers(rr.performance_area, ST_SetSRID(ST_MakePoint(${p(f.center.lng)}, ${p(f.center.lat)}),4326))`);
  if (f.location === "mapped") where.push("search_point.point IS NOT NULL"); if (f.location === "off-map") where.push("search_point.point IS NULL");
  if (f.ownership === "mine") where.push(`er.organization_id = ${p(input.actor.organizationId)}::uuid`); if (f.ownership === "others") where.push(`er.organization_id <> ${p(input.actor.organizationId)}::uuid`);
  for (const tag of f.metadata) where.push(`(er.metadata::text ILIKE ${p(`%${tag}%`)} OR COALESCE(req.metadata::text,'') ILIKE ${p(`%${tag}%`)} OR COALESCE(claim.name,'') ILIKE ${p(`%${tag}%`)})`);
  for (const [key, selected] of Object.entries(f.facets ?? {})) { if (!selected.length) continue; const patterns = selected.map((value) => `%${value}%`); const token = p(patterns); if (["organization","issuer","provider"].includes(key)) where.push(`o.name ILIKE ANY(${token}::text[])`); else if (key === "procurementType") where.push(`rr.solicitation_type ILIKE ANY(${token}::text[])`); else if (key === "status") where.push(`COALESCE(rr.lifecycle_status, er.status) ILIKE ANY(${token}::text[])`); else if (key === "category") where.push(`res.category ILIKE ANY(${token}::text[])`); else if (key === "availability") where.push(`res.availability_label ILIKE ANY(${token}::text[])`); else if (key === "signal") where.push(`ir.signal_type ILIKE ANY(${token}::text[])`); else if (key === "dataset") where.push(`src.source_label ILIKE ANY(${token}::text[])`); else if (key === "amacs") where.push(`COALESCE(claim.amacs_concept_id, cap.amacs_node_id, '') ILIKE ANY(${token}::text[])`); else if (key === "capability") where.push(`COALESCE(claim.name, req.label, er.metadata::text, '') ILIKE ANY(${token}::text[])`); else if (key === "evidence") where.push(`cap.evidence_state ILIKE ANY(${token}::text[])`); else where.push(`er.metadata::text ILIKE ANY(${token}::text[])`); }

  const joins = `FROM exchange_records er JOIN organizations o ON o.id=er.organization_id LEFT JOIN locations l ON l.id=er.location_id LEFT JOIN geographies g ON g.id=l.geography_id LEFT JOIN LATERAL (SELECT CASE WHEN l.point IS NOT NULL AND COALESCE(l.visibility::text,'exact')='exact' THEN l.point::geometry WHEN g.centroid IS NOT NULL THEN g.centroid::geometry ELSE NULL END AS point) search_point ON true LEFT JOIN rfx_records rr ON rr.exchange_record_id=er.id LEFT JOIN LATERAL (SELECT label, metadata FROM rfx_requirements rreq WHERE rreq.rfx_record_id=rr.id ORDER BY sort_order LIMIT 1) req ON true LEFT JOIN resources res ON res.exchange_record_id=er.id LEFT JOIN intelligence_records ir ON ir.exchange_record_id=er.id LEFT JOIN LATERAL (SELECT source_label FROM intelligence_sources isrc WHERE isrc.intelligence_record_id=ir.id ORDER BY created_at DESC LIMIT 1) src ON true LEFT JOIN capabilities cap ON cap.exchange_record_id=er.id LEFT JOIN LATERAL (SELECT c.name,c.description,c.amacs_concept_id FROM organization_capability_claims c WHERE c.organization_id=er.organization_id AND c.claim_status='active' ORDER BY c.created_at LIMIT 1) claim ON true LEFT JOIN organization_profiles op ON op.organization_id=o.id LEFT JOIN organization_media om ON om.organization_id=o.id AND om.media_role='intro_video' LEFT JOIN sponsored_placements sp ON sp.exchange_record_id=er.id AND sp.starts_at<=now() AND (sp.ends_at IS NULL OR sp.ends_at>now())`;
  const offset = cursorOffset(input.cursor); const limit = Math.max(1, Math.min(input.limit ?? 30, 100)); const limitToken=p(limit+1), offsetToken=p(offset);
  const order = state.sort === "recent" ? "er.updated_at DESC, er.public_id" : state.sort === "title" ? "er.title, er.public_id" : state.sort === "geography" ? "COALESCE(er.geography_label,g.name,l.label,''),er.public_id" : "search_score DESC, er.updated_at DESC, er.public_id";
  const sql = `SELECT er.public_id, er.record_type::text, er.organization_id::text, o.name AS organization_name, er.title, er.summary, COALESCE(NULLIF(er.geography_label,''),g.name,l.label,er.metadata->>'geography') AS geography, er.metadata, CASE WHEN search_point.point IS NULL THEN NULL ELSE ST_Y(search_point.point) END AS lat, CASE WHEN search_point.point IS NULL THEN NULL ELSE ST_X(search_point.point) END AS lng, (er.organization_id=${p(input.actor.organizationId)}::uuid) AS owned, EXISTS(SELECT 1 FROM record_relationships rel WHERE rel.user_id=${p(input.actor.userId)}::uuid AND rel.exchange_record_id=er.id AND rel.relationship_kind='saved') AS saved, EXISTS(SELECT 1 FROM record_relationships rel WHERE rel.user_id=${p(input.actor.userId)}::uuid AND rel.exchange_record_id=er.id AND rel.relationship_kind='following') AS following, EXISTS(SELECT 1 FROM record_relationships rel WHERE rel.user_id=${p(input.actor.userId)}::uuid AND rel.exchange_record_id=er.id AND rel.relationship_kind='watching') AS watching, EXISTS(SELECT 1 FROM record_relationships rel WHERE rel.user_id=${p(input.actor.userId)}::uuid AND rel.exchange_record_id=er.id AND rel.relationship_kind='tracking') AS tracking, (sp.id IS NOT NULL) AS sponsored, sp.label AS sponsor_label, ${score} AS score, COUNT(*) OVER() AS total_count, COUNT(*) FILTER(WHERE search_point.point IS NOT NULL) OVER() AS mapped_count, er.updated_at, rr.solicitation_type AS rfx_type, rr.lifecycle_status AS rfx_status, rr.due_at AS rfx_due_at, res.category AS resource_category, res.availability_state AS resource_availability, res.availability_label AS resource_availability_label, res.capacity AS resource_capacity, res.service_area_label AS resource_service_area, res.visibility AS resource_visibility, res.terms AS resource_terms, res.status AS resource_status, ir.signal_type AS intelligence_signal, ir.source_type AS intelligence_source_type, cap.amacs_node_id AS capability_amacs, cap.evidence_state AS capability_evidence_state, cap.publication_status AS capability_publication_status, op.logo_url, om.source_type::text AS media_source_type, om.provider::text AS media_provider, om.provider_video_id AS media_provider_video_id, om.poster_url AS media_poster_url, om.playback_url AS media_playback_url, om.status::text AS media_status ${joins} WHERE ${where.join(" AND ")} GROUP BY er.id,o.id,g.id,l.id,rr.id,res.id,ir.id,cap.id,op.organization_id,om.id,sp.id,search_point.point,req.label,req.metadata,src.source_label,claim.name,claim.description,claim.amacs_concept_id ORDER BY ${order} LIMIT ${limitToken} OFFSET ${offsetToken}`;
  const result = await query<SearchRow>(sql, values); const page = result.rows.slice(0,limit); const first=result.rows[0]; const total=first?Number(first.total_count):0; const mapped=first?Number(first.mapped_count):0; const records=page.map(toRecord); const hasMore=result.rows.length>limit || offset+limit<total;
  const results = page.map((row,index)=>{const q=text.toLowerCase();const matchedFields=text?[row.public_id.toLowerCase().includes(q)?"identifier":undefined,row.title.toLowerCase().includes(q)?"title":undefined,row.organization_name.toLowerCase().includes(q)?"organization":undefined,row.summary.toLowerCase().includes(q)?"summary":undefined,row.geography?.toLowerCase().includes(q)?"geography":undefined].filter((item):item is string=>Boolean(item)):[];return{record:records[index],match:{score:Number(row.score),matchedFields,explanation:matchedFields.length?`Matched ${matchedFields.join(", ")}`:undefined}};});

  const facetValues = page.flatMap((row): FacetRow[] => [
    { key:"organization",value:row.organization_name,count:1 },
    ...(row.rfx_type?[{key:"procurementType",value:row.rfx_type,count:1}]:[]),
    ...(row.rfx_status?[{key:"status",value:row.rfx_status,count:1}]:[]),
    ...(row.resource_category?[{key:"category",value:row.resource_category,count:1}]:[]),
    ...(row.resource_availability_label?[{key:"availability",value:row.resource_availability_label,count:1}]:[]),
    ...(row.intelligence_signal?[{key:"signal",value:row.intelligence_signal,count:1}]:[]),
    ...(row.capability_amacs?[{key:"amacs",value:row.capability_amacs,count:1}]:[]),
    ...(row.capability_evidence_state?[{key:"evidence",value:row.capability_evidence_state,count:1}]:[]),
  ]);
  const facetMap = new Map<string,Map<string,number>>(); for(const item of facetValues){const group=facetMap.get(item.key)??new Map<string,number>();group.set(item.value,(group.get(item.value)??0)+1);facetMap.set(item.key,group);} const responseFacets=Object.fromEntries([...facetMap].map(([key,group])=>[key,[...group].map(([value,count])=>({value,count})).sort((a,b)=>b.count-a.count||a.value.localeCompare(b.value))]));
  return { lens:input.lens,state,results,total,mapped,offMap:Math.max(0,total-mapped),hasMore,nextCursor:hasMore?encodeCursor(offset+limit):undefined,facets:responseFacets };
}

export function searchFingerprint(response: ExchangeSearchResponse) { return JSON.stringify(response.results.map((item)=>[item.record.id,item.record.title,item.record.card?.status?.label,item.record.metadata]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))); }
export function searchRecordSummary(response: ExchangeSearchResponse) { return response.results.map((item)=>({ id:item.record.id,title:item.record.title,updatedAt:item.record.metadata.find((value)=>value.startsWith("Updated:")) ?? isoDate(null) })); }
