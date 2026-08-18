"use client";

import type { ExchangeLens, ExchangeSearchResponse, ExchangeSearchState, SavedSearch, SearchLibrary } from "./contracts";
import { withBasePath } from "./base-path";
import { searchStateToParams } from "./search";

export class SearchClientError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SearchClientError";
    this.status = status;
    this.code = code;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withBasePath(path), { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  if (!response.ok) {
    let payload: { error?: string; code?: string } = {};
    try { payload = await response.json() as typeof payload; } catch {}
    throw new SearchClientError(payload.error ?? `Search request failed (${response.status}).`, response.status, payload.code);
  }
  return response.json() as Promise<T>;
}

export function fetchExchangeSearch(lens: ExchangeLens, state: ExchangeSearchState, options: { cursor?: string; limit?: number; signal?: AbortSignal } = {}) {
  const params = searchStateToParams(state);
  params.set("lens", lens);
  if (options.cursor) params.set("cursor", options.cursor);
  if (options.limit) params.set("limit", String(options.limit));
  return fetchJson<ExchangeSearchResponse>(`/api/exchange/results?${params.toString()}`, { signal: options.signal });
}

export function fetchSearchLibrary(lens: ExchangeLens) {
  const params = new URLSearchParams({ lens });
  return fetchJson<SearchLibrary>(`/api/exchange/searches?${params.toString()}`);
}

export function recordRecentSearch(lens: ExchangeLens, state: ExchangeSearchState, resultCount: number) {
  return fetchJson<{ ok: true }>("/api/exchange/searches/recent", {
    method: "POST",
    body: JSON.stringify({ lens, state, resultCount }),
  });
}

export function createSavedSearch(input: { name: string; lens: ExchangeLens; state: ExchangeSearchState; alertEnabled?: boolean }) {
  return fetchJson<SavedSearch>("/api/exchange/searches", { method: "POST", body: JSON.stringify(input) });
}

export function updateSavedSearch(id: string, patch: { name?: string; state?: ExchangeSearchState; alertEnabled?: boolean }) {
  return fetchJson<SavedSearch>(`/api/exchange/searches/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
}

export async function deleteSavedSearch(id: string) {
  await fetchJson<{ ok: true }>(`/api/exchange/searches/${encodeURIComponent(id)}`, { method: "DELETE" });
}
