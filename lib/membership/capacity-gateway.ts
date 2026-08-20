import { foundingMembership } from "./catalog";

export class MembershipCapacityUnavailableError extends Error {
  constructor(message = "RFxchange membership capacity service is not configured.") {
    super(message);
    this.name = "MembershipCapacityUnavailableError";
  }
}

export class MembershipCapacityFullError extends Error {
  constructor() {
    super("Founding Membership has reached its organization capacity.");
    this.name = "MembershipCapacityFullError";
  }
}

export class MembershipCapacityExistingError extends Error {
  constructor() {
    super("This organization already has or is reserving a Founding Membership.");
    this.name = "MembershipCapacityExistingError";
  }
}

export type MembershipCapacityReservation = {
  reservationId: string;
};

function capacityEndpoint() {
  const value = process.env.RFXCHANGE_MEMBERSHIP_CAPACITY_ENDPOINT?.trim();
  if (!value) {
    throw new MembershipCapacityUnavailableError(
      "Founding Membership checkout requires RFXCHANGE_MEMBERSHIP_CAPACITY_ENDPOINT.",
    );
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new MembershipCapacityUnavailableError(
      "RFXCHANGE_MEMBERSHIP_CAPACITY_ENDPOINT must be a valid HTTP(S) URL.",
    );
  }

  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new MembershipCapacityUnavailableError(
      "RFXCHANGE_MEMBERSHIP_CAPACITY_ENDPOINT must use HTTP(S).",
    );
  }

  if (process.env.NODE_ENV === "production" && endpoint.protocol !== "https:") {
    throw new MembershipCapacityUnavailableError(
      "Production membership capacity requires an HTTPS endpoint.",
    );
  }

  return endpoint;
}

async function callCapacityService(body: Record<string, unknown>) {
  const response = await fetch(capacityEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.RFXCHANGE_MEMBERSHIP_CAPACITY_TOKEN?.trim()
        ? { Authorization: `Bearer ${process.env.RFXCHANGE_MEMBERSHIP_CAPACITY_TOKEN.trim()}` }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (response.status === 409 && payload?.code === "capacity_full") {
    throw new MembershipCapacityFullError();
  }
  if (response.status === 409 && payload?.code === "membership_exists") {
    throw new MembershipCapacityExistingError();
  }
  if (!response.ok) {
    throw new Error(`Membership capacity service rejected the request (${response.status}).`);
  }
  return payload;
}

export async function reserveFoundingMembershipCapacity(input: {
  organizationId: string;
  userId: string;
}): Promise<MembershipCapacityReservation> {
  const payload = await callCapacityService({
    action: "reserve",
    plan: foundingMembership.code,
    organizationId: input.organizationId,
    userId: input.userId,
    limit: foundingMembership.capacity.limit,
  });

  const reservationId = typeof payload?.reservationId === "string"
    ? payload.reservationId.trim()
    : "";
  if (!reservationId) {
    throw new Error("Membership capacity service did not return a reservationId.");
  }

  return { reservationId: reservationId.slice(0, 240) };
}

export async function releaseFoundingMembershipCapacity(reservationId: string) {
  if (!reservationId.trim()) return;
  await callCapacityService({
    action: "release",
    plan: foundingMembership.code,
    reservationId: reservationId.trim().slice(0, 240),
  });
}

export async function publishCapacityStripeEvent(event: unknown) {
  await callCapacityService({
    action: "stripe_event",
    plan: foundingMembership.code,
    event,
  });
}
