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

export function listIntelligenceRecords(options: { query?: string; offset?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (options.query?.trim()) params.set("q", options.query.trim());
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
