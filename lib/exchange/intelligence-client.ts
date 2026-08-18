"use client";

import { withBasePath } from "./base-path";
import type {
  IntelligenceCompareRequest,
  IntelligenceCompareResponse,
  IntelligenceDetail,
  IntelligenceInsightInput,
  IntelligenceListResponse,
  IntelligenceMatchCandidate,
  IntelligenceNote,
  IntelligenceReferralInput,
  IntelligenceReferralResult,
} from "./intelligence";

export interface IntelligenceActivityEvent {
  id: string;
  eventName: string;
  occurredAt: string;
}

export interface IntelligenceDiscoveryRequest {
  query?: string;
  geography?: string;
  location?: "all" | "mapped" | "off-map";
  ownership?: "all" | "mine" | "others";
  tags?: string[];
  trackedOnly?: boolean;
  sort?: "relevance" | "title" | "organization" | "geography";
  offset?: number;
  limit?: number;
}

export class IntelligenceServiceError extends Error {
  code?: string;
  status: number;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "IntelligenceServiceError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(path), {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new IntelligenceServiceError(typeof payload.error === "string" ? payload.error : `Intelligence service returned ${response.status}.`, response.status, typeof payload.code === "string" ? payload.code : undefined);
  return payload as T;
}

export function listIntelligenceRecords(options: IntelligenceDiscoveryRequest = {}) {
  // Universal Search is encoded in the Exchange URL. Carry those filters into the
  // authenticated service so pagination/counts are computed on the same result set.
  const current = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const params = new URLSearchParams();
  const query = options.query?.trim() ?? current.get("q")?.trim() ?? "";
  const geography = options.geography?.trim() ?? current.get("geo")?.trim() ?? "";
  const location = options.location ?? (current.get("location") === "mapped" || current.get("location") === "off-map" ? current.get("location") as "mapped" | "off-map" : "all");
  const ownership = options.ownership ?? (current.get("ownership") === "mine" || current.get("ownership") === "others" ? current.get("ownership") as "mine" | "others" : "all");
  const tags = options.tags ?? current.getAll("tag").filter(Boolean);
  const sortFromUrl = current.get("sort");
  const sort = options.sort ?? (sortFromUrl === "title" || sortFromUrl === "organization" || sortFromUrl === "geography" ? sortFromUrl : "relevance");

  if (query) params.set("q", query);
  if (geography) params.set("geo", geography);
  if (location !== "all") params.set("location", location);
  if (ownership !== "all") params.set("ownership", ownership);
  for (const tag of tags) if (tag.trim()) params.append("tag", tag.trim());
  if (options.trackedOnly) params.set("tracked", "1");
  if (sort !== "relevance") params.set("sort", sort);
  params.set("offset", String(options.offset ?? 0));
  params.set("limit", String(options.limit ?? 24));
  return requestJson<IntelligenceListResponse>(`/api/exchange/intelligence?${params}`);
}

export function getIntelligenceRecord(recordId: string) {
  return requestJson<IntelligenceDetail>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}`);
}

export function createIntelligenceRecord(input: IntelligenceInsightInput) {
  return requestJson<IntelligenceDetail>("/api/exchange/intelligence", { method: "POST", body: JSON.stringify(input) });
}

export function updateIntelligenceRecord(recordId: string, input: IntelligenceInsightInput) {
  return requestJson<IntelligenceDetail>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}`, { method: "PATCH", body: JSON.stringify(input) });
}

export function createIntelligenceNote(recordId: string, input: { body: string; visibility: IntelligenceNote["visibility"] }) {
  return requestJson<IntelligenceNote>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/notes`, { method: "POST", body: JSON.stringify(input) });
}

export function updateIntelligenceTracking(recordId: string, input: { active: boolean; mode: "track" | "follow" }) {
  return requestJson<IntelligenceDetail>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/tracking`, { method: "PUT", body: JSON.stringify(input) });
}

export function compareIntelligenceRecords(input: IntelligenceCompareRequest) {
  return requestJson<IntelligenceCompareResponse>("/api/exchange/intelligence/compare", { method: "POST", body: JSON.stringify(input) });
}

export async function getIntelligenceMatchCandidates(recordId: string) {
  const response = await requestJson<{ matches: IntelligenceMatchCandidate[] }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/matches`);
  return response.matches;
}

export function createIntelligenceReferral(recordId: string, input: IntelligenceReferralInput) {
  return requestJson<IntelligenceReferralResult>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/referrals`, { method: "POST", body: JSON.stringify(input) });
}

export async function getIntelligenceActivity(recordId: string) {
  const response = await requestJson<{ events: IntelligenceActivityEvent[] }>(`/api/exchange/intelligence/${encodeURIComponent(recordId)}/activity`);
  return response.events;
}
