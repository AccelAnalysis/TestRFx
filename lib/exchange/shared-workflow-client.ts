import type { RelationshipKind } from "./shared-workflows";

export class SharedWorkflowClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "SharedWorkflowClientError";
  }
}

async function request<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch("/api/exchange/workflows", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new SharedWorkflowClientError(response.status, payload.error ?? "Shared Exchange workflow failed.");
  return payload;
}

export function setSharedRelationship(recordId: string, kind: RelationshipKind, active: boolean, source: "card" | "detail" | "menu" | "action-rail" = "card") {
  const actionId = kind === "saved" ? "save" : kind === "watching" ? "watch" : kind === "tracking" ? "track" : "follow";
  return request<{ relationship: { recordId: string; kind: RelationshipKind; active: boolean } }>({ actionId, recordId, source, payload: { active } });
}

export function createSharedReferral(recordId: string, recipientOrganizationId: string, note = "", source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return request<{ referral: { id: string; status: string; policy?: unknown } }>({ actionId: "refer", recordId, source, payload: { recipientOrganizationId, note } });
}

export function createSharedShareLink(recordId: string, source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return request<{ share: { id?: string; token: string; recordId: string; deepLink: string } }>({ actionId: "share", recordId, source });
}

export function requestSharedMatch(recordId: string, source: "card" | "detail" | "menu" | "action-rail" = "detail") {
  return request<{ matches: unknown }>({ actionId: "match", recordId, source });
}
