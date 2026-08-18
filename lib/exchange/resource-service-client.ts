import type { ExchangeRecord } from "./contracts";
import type { ResourceDraft, ResourceRequestDraft } from "./resources";
import type { ReferralPolicySnapshot, ResourceRelationshipKind } from "@/lib/server/exchange/resource-service";

export class ResourceServiceClientError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ResourceServiceClientError";
    this.status = status;
    this.code = code;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    credentials: "same-origin",
  });
  const body = await response.json().catch(() => ({})) as { error?: string; code?: string } & T;
  if (!response.ok) throw new ResourceServiceClientError(body.error ?? "The Resources service could not complete this request.", response.status, body.code);
  return body;
}

export async function listResourcesFromService() {
  return requestJson<{ records: ExchangeRecord[] }>("/api/exchange/resources", { method: "GET" });
}

export async function offerResourceThroughService(draft: ResourceDraft) {
  return requestJson<{ record: ExchangeRecord }>("/api/exchange/resources", { method: "POST", body: JSON.stringify(draft) });
}

export async function updateResourceThroughService(recordId: string, draft: ResourceDraft) {
  return requestJson<{ record: ExchangeRecord }>(`/api/exchange/resources/${encodeURIComponent(recordId)}`, { method: "PATCH", body: JSON.stringify(draft) });
}

export async function archiveResourceThroughService(recordId: string) {
  return requestJson<{ status: "archived" }>(`/api/exchange/resources/${encodeURIComponent(recordId)}`, { method: "DELETE" });
}

export async function requestResourceThroughService(recordId: string, request: ResourceRequestDraft) {
  return requestJson<{ request: { id: string; status: string; created_at: string } }>(`/api/exchange/resources/${encodeURIComponent(recordId)}/requests`, { method: "POST", body: JSON.stringify(request) });
}

export async function setResourceRelationshipThroughService(recordId: string, kind: ResourceRelationshipKind, active: boolean) {
  return requestJson<{ relationship: { kind: ResourceRelationshipKind; active: boolean } }>(`/api/exchange/resources/${encodeURIComponent(recordId)}/relationships`, { method: "PUT", body: JSON.stringify({ kind, active }) });
}

export async function shareResourceThroughService(recordId: string, recipientOrganization: string, message: string) {
  return requestJson<{ share: { id: string; status: string; recipientOrganization: string } }>(`/api/exchange/resources/${encodeURIComponent(recordId)}/shares`, { method: "POST", body: JSON.stringify({ recipientOrganization, message }) });
}

export async function getResourceReferralPolicy(recipientOrganization: string) {
  const query = new URLSearchParams({ recipientOrganization });
  return requestJson<{ policy: ReferralPolicySnapshot }>(`/api/exchange/referrals/policy?${query.toString()}`, { method: "GET" });
}

export async function createResourceReferralThroughService(recordId: string, recipientOrganization: string, message: string) {
  return requestJson<{ referral: { id: string; status: string; policy: ReferralPolicySnapshot } }>("/api/exchange/referrals", { method: "POST", body: JSON.stringify({ recordId, recipientOrganization, message }) });
}
