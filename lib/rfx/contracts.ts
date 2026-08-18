export type RfxType = "RFI" | "RFQ" | "RFP" | "Sources Sought" | "Supplier Request" | "Service Request";
export type RfxSource = "rfxchange" | "external";
export type RfxStatus = "draft" | "open" | "closing-soon" | "closed" | "evaluation" | "selected";

export type RfxRequirementKind = "capability" | "eligibility" | "documentation" | "commercial";

export interface RfxRequirement {
  id: string;
  label: string;
  kind: RfxRequirementKind;
  mandatory: boolean;
  profileState?: "matched" | "confirm" | "gap";
}

export interface RfxMatchSummary {
  matched: number;
  total: number;
  geographyMatched: boolean;
  summary: string;
}

export interface RfxDetail {
  exchangeRecordId: string;
  solicitationNumber: string;
  rfxType: RfxType;
  source: RfxSource;
  status: RfxStatus;
  issuedAt?: string;
  closesAt?: string;
  performanceGeography: string;
  estimatedValue?: string;
  scope: string;
  deliverables: string[];
  requirements: RfxRequirement[];
  responseRequirements: string[];
  evaluationMethod?: string;
  match?: RfxMatchSummary;
  externalSubmissionRequired?: boolean;
}

export type RfxPursuitState = "discovered" | "watching" | "assessing" | "declined" | "pursuing" | "teaming" | "drafting" | "ready" | "submitted";
