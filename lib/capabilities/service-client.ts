import type { CapabilityOrganizationProfile } from "./contracts";
import { capabilityProfileToExchangeRecord } from "./contracts";

export class CapabilityServiceClientError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "CapabilityServiceClientError";
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
  if (!response.ok) throw new CapabilityServiceClientError(response.status, payload.error ?? "Capabilities service failed.");
  return payload;
}

export async function loadCapabilityProfiles() {
  const payload = await request<{ profiles: CapabilityOrganizationProfile[] }>("/api/exchange/capabilities");
  return { profiles: payload.profiles, records: payload.profiles.map(capabilityProfileToExchangeRecord) };
}

export async function publishCapabilityProfile() {
  const payload = await request<{ profile: CapabilityOrganizationProfile }>("/api/exchange/capabilities", {
    method: "POST",
    body: JSON.stringify({ action: "publish" }),
  });
  return { profile: payload.profile, record: capabilityProfileToExchangeRecord(payload.profile) };
}
