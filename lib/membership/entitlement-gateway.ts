export class MembershipEntitlementUnavailableError extends Error {
  constructor(message = "RFxchange membership entitlement service is not configured.") {
    super(message);
    this.name = "MembershipEntitlementUnavailableError";
  }
}

function entitlementEndpoint() {
  const value = process.env.RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT?.trim();
  if (!value) {
    throw new MembershipEntitlementUnavailableError(
      "Membership activation requires RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new MembershipEntitlementUnavailableError(
      "RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new MembershipEntitlementUnavailableError(
      "RFXCHANGE_MEMBERSHIP_EVENT_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new MembershipEntitlementUnavailableError(
      "Production membership events require an HTTPS endpoint.",
    );
  }

  return endpoint;
}

export async function publishMembershipEvent(event: unknown) {
  const response = await fetch(entitlementEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RFXCHANGE_MEMBERSHIP_EVENT_TOKEN?.trim()
        ? { Authorization: `Bearer ${process.env.RFXCHANGE_MEMBERSHIP_EVENT_TOKEN.trim()}` }
        : {}),
    },
    body: JSON.stringify(event),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Membership entitlement service rejected the event (${response.status}).`);
  }
}
