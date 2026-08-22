import type { ResourceAvailabilityState, ResourceVisibility } from "@/lib/exchange/contracts";
import type { ResourceDraft, ResourceRequestDraft } from "@/lib/exchange/resources";

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
  const neededBy = optionalString(input.neededBy);
  if (neededBy && !/^\d{4}-\d{2}-\d{2}$/.test(neededBy)) throw new ExchangeInvalidInputError("Needed-by date must use YYYY-MM-DD.");
  return {
    scope: requiredString(input.scope, "Requested scope / amount"),
    neededBy,
    message: requiredString(input.message, "Message"),
  };
}

export function parseOrganizationShare(body: unknown) {
  if (!body || typeof body !== "object") throw new ExchangeInvalidInputError("Choose a receiving organization and try again.");
  const input = body as Record<string, unknown>;
  return {
    recipientOrganizationId: requiredString(input.recipientOrganizationId, "Receiving organization"),
    message: optionalString(input.message),
  };
}
