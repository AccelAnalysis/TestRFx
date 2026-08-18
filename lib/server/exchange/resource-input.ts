import type { ResourceAvailabilityState, ResourceVisibility } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";
import type { ResourceRelationshipKind } from "./resource-service";

export class ExchangeInvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExchangeInvalidInputError";
  }
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new ExchangeInvalidInputError(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseResourceDraft(body: unknown): ResourceDraft {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Enter the Resource details and try again.");
  const input = body as Record<string, unknown>;
  const availabilityValues: ResourceAvailabilityState[] = ["available", "limited", "scheduled"];
  const visibilityValues: ResourceVisibility[] = ["public-location", "service-area", "off-map"];
  if (!availabilityValues.includes(input.availability as ResourceAvailabilityState)) throw new ExchangeInvalidInputError("Choose a valid Resource availability state.");
  if (!visibilityValues.includes(input.visibility as ResourceVisibility)) throw new ExchangeInvalidInputError("Choose a valid Resource map visibility.");

  return {
    title: requiredString(input.title, "Resource title"),
    category: requiredString(input.category, "Category"),
    summary: requiredString(input.summary, "Description"),
    geography: requiredString(input.geography, "Geography"),
    availability: input.availability as ResourceAvailabilityState,
    availabilityLabel: requiredString(input.availabilityLabel, "Availability label"),
    capacity: optionalString(input.capacity),
    serviceArea: optionalString(input.serviceArea),
    visibility: input.visibility as ResourceVisibility,
    terms: optionalString(input.terms),
  };
}

export function parseResourceRequest(body: unknown): ResourceRequestDraft {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Enter the Resource request and try again.");
  const input = body as Record<string, unknown>;
  return {
    scope: requiredString(input.scope, "Requested scope / amount"),
    neededBy: optionalString(input.neededBy),
    message: requiredString(input.message, "Message"),
  };
}

export function parseResourceRelationship(body: unknown) {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Choose a Resource relationship and try again.");
  const input = body as Record<string, unknown>;
  if (input.kind !== "saved" && input.kind !== "following") throw new ExchangeInvalidInputError("Choose Save or Follow.");
  if (typeof input.active !== "boolean") throw new ExchangeInvalidInputError("Relationship state is required.");
  return { kind: input.kind as ResourceRelationshipKind, active: input.active };
}

export function parseOrganizationMessage(body: unknown, messageRequired = false) {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Choose a receiving organization and try again.");
  const input = body as Record<string, unknown>;
  const message = optionalString(input.message);
  if (messageRequired && !message) throw new ExchangeInvalidInputError("Message is required.");
  return { recipientOrganization: requiredString(input.recipientOrganization, "Receiving organization"), message };
}

export function parseReferral(body: unknown) {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Enter the referral details and try again.");
  const input = body as Record<string, unknown>;
  return {
    recordId: requiredString(input.recordId, "Resource record"),
    recipientOrganization: requiredString(input.recipientOrganization, "Receiving organization"),
    message: optionalString(input.message),
  };
}
