import "server-only";

import { neon } from "@neondatabase/serverless";
import type { ExchangeRecord } from "@/lib/exchange/contracts";

export class CapabilityCatalogUnavailableError extends Error {}

function database() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new CapabilityCatalogUnavailableError("Capability discovery requires DATABASE_URL.");
  return neon(url);
}

function metadataStrings(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (!value || typeof value !== "object") return [];
  const values = Object.entries(value as Record<string, unknown>).flatMap(([key, current]) => {
    if (typeof current === "string" && current.trim()) return [`${key}: ${current}`];
    if (typeof current === "number" || typeof current === "boolean") return [`${key}: ${String(current)}`];
    if (Array.isArray(current)) return current.filter((item): item is string => typeof item === "string");
    return [];
  });
  return [...new Set(values)].slice(0, 16);
}

function geographyLabel(label: unknown, address: unknown) {
  if (typeof label === "string" && label.trim()) return label.trim();
  if (!address || typeof address !== "object" || Array.isArray(address)) return "Service geography not published";
  const record = address as Record<string, unknown>;
  return [record.city, record.state, record.postalCode].filter((item): item is string => typeof item === "string" && item.trim().length > 0).join(", ") || "Service geography not published";
}

export async function listCanonicalCapabilityExchangeRecords(): Promise<ExchangeRecord[]> {
  const sql = database();
  const rows = await sql.query(
    `SELECT er.public_id,
            er.title,
            er.summary,
            er.status,
            er.metadata,
            er.organization_id::text AS organization_id,
            o.name AS organization_name,
            c.amacs_node_id,
            c.evidence_state,
            c.evidence,
            l.label AS location_label,
            l.address,
            CASE WHEN l.point IS NULL THEN NULL ELSE ST_Y(l.point::geometry) END AS lat,
            CASE WHEN l.point IS NULL THEN NULL ELSE ST_X(l.point::geometry) END AS lng
       FROM exchange_records er
       JOIN organizations o ON o.id = er.organization_id
       JOIN capabilities c ON c.exchange_record_id = er.id
       LEFT JOIN locations l ON l.id = er.location_id
      WHERE er.record_type = 'capability'
        AND er.status = 'active'
      ORDER BY er.updated_at DESC, er.public_id ASC`,
  ) as Array<Record<string, unknown>>;

  return rows.map((row) => {
    const metadata = metadataStrings(row.metadata);
    if (typeof row.amacs_node_id === "string" && row.amacs_node_id) metadata.push(`AMACS: ${row.amacs_node_id}`);
    if (typeof row.evidence_state === "string" && row.evidence_state) metadata.push(`Evidence: ${row.evidence_state}`);
    const evidenceCount = Array.isArray(row.evidence) ? row.evidence.length : 0;
    if (evidenceCount) metadata.push(`${evidenceCount} evidence item${evidenceCount === 1 ? "" : "s"}`);
    const lat = typeof row.lat === "number" ? row.lat : row.lat === null || row.lat === undefined ? undefined : Number(row.lat);
    const lng = typeof row.lng === "number" ? row.lng : row.lng === null || row.lng === undefined ? undefined : Number(row.lng);
    return {
      id: String(row.public_id),
      type: "capability" as const,
      title: String(row.title ?? "Capability"),
      organization: String(row.organization_name ?? "Organization"),
      summary: String(row.summary ?? ""),
      geography: geographyLabel(row.location_label, row.address),
      metadata: [...new Set(metadata)],
      location: Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat as number, lng: lng as number } : undefined,
    };
  });
}
