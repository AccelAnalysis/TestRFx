import type { ExchangeRecord } from "./contracts";
import type { IntelligenceActivityItem, IntelligenceCompareDimension, IntelligenceCompareResponse, IntelligenceDetail, IntelligenceInsightInput, IntelligenceListResponse, IntelligenceNote } from "./intelligence-runtime";
import { createSharedReferral, getSharedReferralPolicy, searchSharedOrganizations, setSharedRelationship } from "./shared-workflow-client";

export class IntelligenceClientError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "IntelligenceClientError"; }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "same-origin", cache: "no-store", headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new IntelligenceClientError(response.status, payload.error ?? "Intelligence service failed.");
  return payload;
}

export function listIntelligenceFromService(query = "", offset = 0, limit = 50) {
  const params = new URLSearchParams({ q: query, offset: String(offset), limit: String(limit) });
  return request<IntelligenceListResponse>(`/api/exchange/intelligence?${params.toString()}`);
}
export function getIntelligenceFromService(recordId: string) { return request<{ detail: IntelligenceDetail; record: ExchangeRecord }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}`); }
export function createIntelligenceThroughService(input: IntelligenceInsightInput) { return request<{ detail: IntelligenceDetail; record: ExchangeRecord }>("/api/exchange/intelligence", { method: "POST", body: JSON.stringify(input) }); }
export function updateIntelligenceThroughService(recordId: string, input: IntelligenceInsightInput) { return request<{ detail: IntelligenceDetail; record: ExchangeRecord }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}`, { method: "PATCH", body: JSON.stringify(input) }); }
export function addIntelligenceNoteThroughService(recordId: string, body: string, visibility: IntelligenceNote["visibility"] = "organization") { return request<{ note: { id?: string; createdAt?: string } }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/notes`, { method: "POST", body: JSON.stringify({ body, visibility }) }); }
export function getIntelligenceActivity(recordId: string) { return request<{ activity: IntelligenceActivityItem[] }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/activity`); }
export function getIntelligenceMatches(recordId: string) { return request<{ matches: Array<{ recordId: string; lens: "rfx" | "capabilities"; title: string; organization: string; reason: string }> }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/matches`); }
export function compareIntelligenceThroughService(dimension: IntelligenceCompareDimension, left: string, right: string) { return request<{ comparison: IntelligenceCompareResponse }>("/api/exchange/intelligence/compare", { method: "POST", body: JSON.stringify({ dimension, left, right }) }); }
export function setIntelligenceTracking(recordId: string, mode: "track" | "follow", active: boolean) { return setSharedRelationship(recordId, mode === "track" ? "tracking" : "following", active, "detail"); }
export function searchIntelligenceReferralOrganizations(query: string) { return searchSharedOrganizations(query); }
export function getIntelligenceReferralPolicy(organizationId: string) { return getSharedReferralPolicy(organizationId); }
export function createIntelligenceReferral(recordId: string, recipientOrganizationId: string, note: string) { return createSharedReferral(recordId, recipientOrganizationId, note, "detail"); }
