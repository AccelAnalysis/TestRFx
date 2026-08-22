import type { RelationshipKind } from "./shared-workflows";

export class SharedWorkflowClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "SharedWorkflowClientError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new SharedWorkflowClientError(response.status, payload.error ?? "Shared Exchange workflow failed.");
  return payload;
}

function execute<T>(body: Record<string, unknown>) {
  return request<T>("/api/exchange/workflows", { method: "POST", body: JSON.stringify(body) });
}

export function setSharedRelationship(recordId: string, kind: RelationshipKind, active: boolean, source: "card" | "detail" | "menu" | "action-rail" = "card") {
  const actionId = kind === "saved" ? "save" : kind === "watching" ? "watch" : kind === "tracking" ? "track" : "follow";
  return execute<{ relationship: { recordId: string; kind: RelationshipKind; active: boolean } }>({ actionId, recordId, source, payload: { active } });
}

export function createSharedReferral(recordId: string, recipientOrganizationId: string, note = "", source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return execute<{ referral: { id: string; status: string; policy?: unknown } }>({ actionId: "refer", recordId, source, payload: { recipientOrganizationId, note } });
}

export function createSharedShareLink(recordId: string, source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return execute<{ share: { id?: string; token: string; recordId: string; deepLink: string } }>({ actionId: "share", recordId, source });
}

export function requestSharedMatch(recordId: string, source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return execute<{ matches: unknown }>({ actionId: "match", recordId, source });
}

export function searchSharedOrganizations(query: string) {
  const params = new URLSearchParams({ q: query });
  return request<{ organizations: Array<{ id: string; name: string }> }>(`/api/exchange/organizations?${params.toString()}`);
}

export function getSharedReferralPolicy(organizationId: string) {
  const params = new URLSearchParams({ organizationId });
  return request<{ policy: {
    organizationId: string;
    published: boolean;
    active: boolean;
    policySummary: string | null;
    feeSummary: string | null;
    rules: unknown[];
    eligibilityCriteria: unknown[];
  } }>(`/api/exchange/referrals/policy?${params.toString()}`);
}
