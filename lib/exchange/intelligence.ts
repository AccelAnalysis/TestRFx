import type { ExchangeRecord } from "./contracts";

export type IntelligenceSourceType = "exchange-activity" | "participant-observation" | "reference-dataset";
export type IntelligenceWorkflow = "add" | "edit" | "note" | "compare";

export interface IntelligenceDetail {
  signalType: string;
  observedPeriod: string;
  sourceLabel: string;
  sourceType: IntelligenceSourceType;
  provenance: string;
  relatedCapabilities: string[];
  relatedOrganizations: string[];
}

export interface IntelligenceInsightInput {
  title: string;
  summary: string;
  geography: string;
  signalType: string;
  observedPeriod: string;
  sourceLabel: string;
  organizationName?: string;
}

export const intelligenceSeed: ExchangeRecord[] = [
  {
    id: "intel-own-001",
    type: "intelligence",
    title: "Regional small-business procurement pattern",
    organization: "Accel Analysis",
    summary: "Participant insight about recurring procurement activity across the local small-business network.",
    geography: "Isle of Wight, VA",
    metadata: ["Participant insight", "90-day view", "Source: organization observation"],
    location: { lat: 36.9, lng: -76.71 },
    ownedByViewer: true,
    saved: true,
    card: { classifications: ["Procurement", "Small Business"], status: { label: "Current", tone: "info" } },
  },
  {
    id: "intel-001",
    type: "intelligence",
    title: "Maritime supplier concentration is rising",
    organization: "RFxchange Intelligence",
    summary: "Capability density increased around the Norfolk–Portsmouth corridor in the deterministic reference dataset.",
    geography: "Hampton Roads, VA",
    metadata: ["Market signal", "30-day view", "Maritime", "Source: reference Exchange activity"],
    location: { lat: 36.84, lng: -76.32 },
    featured: true,
    card: {
      media: { kind: "visualization", label: "Supply signal", src: "/exchange-media/intelligence-maritime-signal.svg", alt: "Illustrated maritime supply-density signal for TestRFx reference intelligence" },
      classifications: ["Maritime", "Supply Density"], status: { label: "Updated", tone: "info" }, placement: "featured",
    },
  },
  {
    id: "intel-002",
    type: "intelligence",
    title: "Training demand exceeds visible local supply",
    organization: "RFxchange Intelligence",
    summary: "Reference demand signal demonstrating an intelligence record that remains useful in the result sheet without a map position.",
    geography: "Virginia",
    metadata: ["Demand signal", "60-day view", "Workforce", "Off-map record"],
    card: { classifications: ["Workforce", "Training"], status: { label: "Current", tone: "info" } },
  },
  {
    id: "intel-003",
    type: "intelligence",
    title: "Industrial electrical capability gap",
    organization: "RFxchange Intelligence",
    summary: "Reference comparison signal showing fewer visible suppliers than opportunity demand in the selected geography.",
    geography: "South Hampton Roads, VA",
    metadata: ["Capability signal", "60-day view", "Electrical", "Source: deterministic reference dataset"],
    location: { lat: 36.78, lng: -76.42 },
    card: { classifications: ["Electrical", "Supply Gap"], status: { label: "Current", tone: "warning" } },
  },
];

export const intelligenceDetails: Record<string, IntelligenceDetail> = {
  "intel-own-001": { signalType: "Participant observation", observedPeriod: "90-day reference window", sourceLabel: "Accel Analysis observation", sourceType: "participant-observation", provenance: "Reference-only participant contribution. Production must retain author, organization, timestamps, visibility, evidence, and revision history server-side.", relatedCapabilities: ["Business Intelligence", "Market Analysis"], relatedOrganizations: ["Accel Analysis"] },
  "intel-001": { signalType: "Market signal", observedPeriod: "30-day reference window", sourceLabel: "Deterministic RFxchange activity fixture", sourceType: "exchange-activity", provenance: "Derived only from deterministic TestRFx fixture data. It is not a census of the market and must not be presented as production market truth.", relatedCapabilities: ["Maritime Services", "Industrial Supply"], relatedOrganizations: ["Tidewater Technical Services", "Atlantic Skills Group"] },
  "intel-002": { signalType: "Demand signal", observedPeriod: "60-day reference window", sourceLabel: "Deterministic TestRFx fixture", sourceType: "reference-dataset", provenance: "Off-map reference signal used to prove that Intelligence results are not restricted to geolocated records.", relatedCapabilities: ["Training", "Workforce Development"], relatedOrganizations: ["Regional Working Dog Institute"] },
  "intel-003": { signalType: "Capability signal", observedPeriod: "60-day reference window", sourceLabel: "Deterministic TestRFx fixture", sourceType: "reference-dataset", provenance: "Reference comparison signal only. Production comparison requires governed supply, demand, geography, freshness, and source provenance.", relatedCapabilities: ["Industrial Electrical Installation"], relatedOrganizations: ["Tidewater Technical Services"] },
};

export function getIntelligenceDetail(record: ExchangeRecord): IntelligenceDetail | undefined {
  if (record.type !== "intelligence") return undefined;
  return intelligenceDetails[record.id] ?? {
    signalType: record.metadata[0] ?? "Participant insight",
    observedPeriod: record.metadata[1] ?? "Current reference session",
    sourceLabel: record.metadata.find((item) => item.startsWith("Source:"))?.replace(/^Source:\s*/, "") ?? "Participant-provided source",
    sourceType: record.ownedByViewer ? "participant-observation" : "reference-dataset",
    provenance: "Created in the TestRFx reference session. Production persistence and provenance services are not asserted by this fixture.",
    relatedCapabilities: [],
    relatedOrganizations: [record.organization],
  };
}

export function buildParticipantInsight(input: IntelligenceInsightInput): ExchangeRecord {
  return {
    id: `intel-session-${Date.now()}`,
    type: "intelligence",
    title: input.title.trim(),
    organization: input.organizationName?.trim() || "Accel Analysis",
    summary: input.summary.trim(),
    geography: input.geography.trim(),
    metadata: [input.signalType.trim() || "Participant insight", input.observedPeriod.trim() || "Current view", `Source: ${input.sourceLabel.trim() || "Participant observation"}`],
    ownedByViewer: true,
    card: { classifications: [input.signalType.trim() || "Participant insight"], status: { label: "Current", tone: "info" } },
  };
}

export function updateParticipantInsight(record: ExchangeRecord, input: IntelligenceInsightInput): ExchangeRecord {
  return {
    ...record,
    organization: input.organizationName?.trim() || record.organization,
    title: input.title.trim(),
    summary: input.summary.trim(),
    geography: input.geography.trim(),
    metadata: [input.signalType.trim() || "Participant insight", input.observedPeriod.trim() || "Current view", `Source: ${input.sourceLabel.trim() || "Participant observation"}`],
    card: { ...record.card, classifications: [input.signalType.trim() || "Participant insight"], status: record.card?.status ?? { label: "Current", tone: "info" } },
  };
}
