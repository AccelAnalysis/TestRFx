import type { RfxDetail } from "./contracts";

export const rfxCatalog: Record<string, RfxDetail> = {
  "rfx-001": {
    exchangeRecordId: "rfx-001",
    solicitationNumber: "CHES-FAC-26-091",
    rfxType: "Sources Sought",
    source: "external",
    status: "open",
    issuedAt: "2026-08-11",
    closesAt: "2026-09-03T16:00:00-04:00",
    performanceGeography: "Chesapeake, Virginia",
    estimatedValue: "$1M–$5M",
    scope: "Multi-trade maintenance and repair services across municipal facilities, including recurring and on-call work.",
    deliverables: ["Capability statement", "Relevant experience", "Service-area confirmation"],
    requirements: [
      { id: "facilities", label: "Facilities maintenance capability", kind: "capability", mandatory: true, profileState: "matched" },
      { id: "multi-trade", label: "Multi-trade field service coverage", kind: "capability", mandatory: true, profileState: "matched" },
      { id: "local", label: "Ability to serve Chesapeake facilities", kind: "eligibility", mandatory: true, profileState: "matched" },
      { id: "capacity", label: "Confirm surge and on-call capacity", kind: "eligibility", mandatory: true, profileState: "confirm" },
    ],
    responseRequirements: ["Respond through the authoritative issuer channel", "Confirm organizational contact information", "Address each mandatory capability"],
    match: { matched: 3, total: 4, geographyMatched: true, summary: "Three of four structured requirements are represented in the reference organization profile; capacity still requires confirmation." },
    externalSubmissionRequired: true,
  },
  "rfx-002": {
    exchangeRecordId: "rfx-002",
    solicitationNumber: "HSA-CYBER-2026-17",
    rfxType: "RFP",
    source: "external",
    status: "open",
    issuedAt: "2026-08-14",
    closesAt: "2026-09-12T16:00:00-04:00",
    performanceGeography: "Norfolk, Virginia / hybrid",
    scope: "Cybersecurity assessment, remediation planning, and continuous advisory support for a regional systems authority.",
    deliverables: ["Assessment plan", "Findings and risk register", "Remediation roadmap", "Advisory support plan"],
    requirements: [
      { id: "assessment", label: "Cybersecurity assessment experience", kind: "capability", mandatory: true, profileState: "matched" },
      { id: "remediation", label: "Remediation planning capability", kind: "capability", mandatory: true, profileState: "matched" },
      { id: "continuous", label: "Continuous advisory capacity", kind: "capability", mandatory: true, profileState: "confirm" },
      { id: "insurance", label: "Required insurance documentation", kind: "documentation", mandatory: true, profileState: "gap" },
    ],
    responseRequirements: ["Technical approach", "Team qualifications", "Relevant experience", "Pricing schedule", "Required representations and attachments"],
    evaluationMethod: "Reference weighted technical, experience, and commercial evaluation. The issuer remains the decision authority.",
    match: { matched: 2, total: 4, geographyMatched: true, summary: "Two requirements are represented, one needs confirmation, and one documentation gap remains." },
    externalSubmissionRequired: true,
  },
  "rfx-003": {
    exchangeRecordId: "rfx-003",
    solicitationNumber: "RFX-DRAFT-003",
    rfxType: "Supplier Request",
    source: "rfxchange",
    status: "draft",
    performanceGeography: "Isle of Wight, Virginia",
    scope: "Reference organization-owned supplier outreach record used to exercise issuer-side RFx actions inside the shared Exchange chassis.",
    deliverables: ["Supplier capability response", "Coverage confirmation"],
    requirements: [
      { id: "small-business", label: "Small-business supplier participation", kind: "eligibility", mandatory: false },
      { id: "coverage", label: "Regional service coverage", kind: "capability", mandatory: true },
    ],
    responseRequirements: ["Organization profile", "Capability summary", "Availability"],
  },
};

export function getRfxDetail(recordId: string): RfxDetail | undefined {
  return rfxCatalog[recordId];
}
