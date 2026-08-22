import type { ExchangeRecord } from "./contracts";
import type { ResourceDraft, ResourceRequestDraft } from "./resources";
import type { RelationshipKind } from "./shared-workflows";

export class ResourceServiceClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ResourceServiceClientError";
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new ResourceServiceClientError(response.status, body.error ?? "The Resources service could not complete this request.");
  return body;
}

export function listResourcesFromService() {
  return requestJson<{ records: ExchangeRecord[]; persistence: "postgresql" }>("/api/exchange/resources");
}

export function offerResourceThroughService(draft: ResourceDraft) {
  return requestJson<{ record: ExchangeRecord; persistence: "postgresql" }>("/api/exchange/resources", {
    method: "POST",
    body: JSON.stringify(draft),
  });
}

export function updateResourceThroughService(recordId: string, draft: ResourceDraft) {
  return requestJson<{ record: ExchangeRecord; persistence: "postgresql" }>(`/api/exchange/resources/${encodeURIComponent(recordId)}`, {
    method: "PATCH",
    body: JSON.stringify(draft),
  });
}

export function archiveResourceThroughService(recordId: string) {
  return requestJson<{ recordId: string; status: "archived"; persistence: "postgresql" }>(`/api/exchange/resources/${encodeURIComponent(recordId)}`, {
    method: "DELETE",
  });
}

export function requestResourceThroughService(recordId: string, request: ResourceRequestDraft) {
  return requestJson<{ request: { id: string; status: string; createdAt: string }; persistence: "postgresql" }>(`/api/exchange/resources/${encodeURIComponent(recordId)}/requests`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function sendResourceThroughService(recordId: string, recipientOrganizationId: string, message: string) {
  return requestJson<{ share: { id: string; status: string; recipientOrganization: { id: string; name: string } } }>(`/api/exchange/resources/${encodeURIComponent(recordId)}/shares`, {
    method: "POST",
    body: JSON.stringify({ recipientOrganizationId, message }),
  });
}

export function setSharedRelationshipThroughService(recordId: string, kind: Extract<RelationshipKind, "saved" | "following">, active: boolean) {
  return requestJson<{ relationship: { recordId: string; kind: RelationshipKind; active: boolean } }>("/api/exchange/workflows", {
    method: "POST",
    body: JSON.stringify({ actionId: kind === "saved" ? "save" : "follow", recordId, source: "card", payload: { active } }),
  });
}

export function createSharedResourceLink(recordId: string) {
  return requestJson<{ share: { id?: string; token: string; recordId: string; deepLink: string } }>("/api/exchange/workflows", {
    method: "POST",
    body: JSON.stringify({ actionId: "share", recordId, source: "detail" }),
  });
}

export function searchExchangeOrganizations(query: string) {
  const params = new URLSearchParams({ q: query });
  return requestJson<{ organizations: Array<{ id: string; name: string }> }>(`/api/exchange/organizations?${params.toString()}`);
}

export function getReferralPolicy(organizationId: string) {
  const params = new URLSearchParams({ organizationId });
  return requestJson<{ policy: {
    organizationId: string;
    published: boolean;
    active: boolean;
    policySummary: string | null;
    feeSummary: string | null;
    rules: unknown[];
    eligibilityCriteria: unknown[];
  } }>(`/api/exchange/referrals/policy?${params.toString()}`);
}

export function createResourceReferral(recordId: string, recipientOrganizationId: string, note: string) {
  return requestJson<{ referral: { id: string; status: string; policy: unknown } }>("/api/exchange/workflows", {
    method: "POST",
    body: JSON.stringify({ actionId: "refer", recordId, source: "detail", payload: { recipientOrganizationId, note } }),
  });
}
