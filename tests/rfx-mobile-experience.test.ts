import { describe, expect, it } from "vitest";
import type { RfxWorkflowNode, RfxWorkspace } from "@/lib/rfx/contracts";
import {
  chapterSummaries,
  estimateResponseEffort,
  matchBreakdown,
  mobileTreatmentFor,
  nextIncompletePath,
  publicationPreflight,
  recommendRfxType,
  responsePreflight,
} from "@/lib/rfx/mobile-experience";

function workspace(values: Record<string, string | boolean | number | null> = {}): RfxWorkspace {
  return {
    id: "rfx-test:issuer",
    recordId: "rfx-test",
    perspective: "issuer",
    entry: "create-rfx",
    activePath: ["create"],
    values,
    completedNodeIds: [],
    items: [],
    rfxStatus: "draft",
    version: 1,
    createdAt: "2026-08-22T12:00:00.000Z",
    updatedAt: "2026-08-22T12:00:00.000Z",
  };
}

const tree: RfxWorkflowNode = {
  id: "create",
  label: "Create RFx",
  description: "Create",
  kind: "sequence",
  children: [
    {
      id: "define-need",
      label: "Define need",
      description: "Need",
      kind: "sequence",
      children: [
        { id: "need", label: "Need", description: "Need", kind: "form", fields: [{ id: "need.text", label: "Need", type: "textarea", required: true }] },
        { id: "select-rfx-type", label: "Type", description: "Type", kind: "decision", fields: [{ id: "need.type", label: "Type", type: "select", required: true, options: ["RFP", "RFQ"] }] },
      ],
    },
    { id: "scope", label: "Scope", description: "Scope", kind: "form", fields: [{ id: "scope.text", label: "Scope", type: "textarea", required: true }] },
    { id: "requirements", label: "Requirements", description: "Requirements", kind: "list", fields: [{ id: "requirement.text", label: "Requirement", type: "text", required: true }] },
    { id: "schedule", label: "Schedule", description: "Schedule", kind: "form", fields: [{ id: "schedule.responseDeadline", label: "Response deadline", type: "date", required: true }] },
    { id: "preview", label: "Preview", description: "Preview", kind: "review" },
  ],
};

describe("RFx mobile experience adapter", () => {
  it("recommends a price-led RFQ without claiming AI authority", () => {
    const result = recommendRfxType("We need comparable unit price quotes for 50 laptops delivered next month.");
    expect(result.type).toBe("RFQ");
    expect(result.reason).toContain("price");
  });

  it("recommends an approach-led RFP and a guided path", () => {
    const result = recommendRfxType("We need a consulting firm to propose an implementation approach and remediation roadmap.");
    expect(result.type).toBe("RFP");
    expect(result.mode).toBe("guided");
  });

  it("maps source nodes to mobile-native treatments", () => {
    expect(mobileTreatmentFor(tree.children![0].children![0], "issuer")).toBe("need-capture");
    expect(mobileTreatmentFor({ id: "go-no-go", label: "Decision", description: "Decision", kind: "decision" }, "responder")).toBe("choice");
    expect(mobileTreatmentFor({ id: "hosted-submission", label: "Submit", description: "Submit", kind: "form" }, "responder")).toBe("hosted-submission");
  });

  it("preserves a concrete next incomplete path", () => {
    const next = nextIncompletePath(tree, workspace());
    expect(next).toEqual(["create", "define-need", "need"]);
  });

  it("summarizes chapter progress instead of exposing raw workflow metadata", () => {
    const state = workspace({ "need.text": "A real need", "need.type": "RFP" });
    state.completedNodeIds = ["need", "select-rfx-type"];
    const chapters = chapterSummaries(tree, state);
    expect(chapters[0].percent).toBe(100);
    expect(chapters[0].nextPath).toBeUndefined();
  });

  it("blocks publication when modeled mandatory work is missing", () => {
    const result = publicationPreflight(tree, workspace({ "experience.mode": "quick" }));
    expect(result.ready).toBe(false);
    expect(result.blockers.map((item) => item.id)).toContain("need");
  });

  it("recognizes a completed quick publication path", () => {
    const state = workspace({
      "experience.mode": "quick",
      "need.text": "Need",
      "need.type": "RFP",
      "scope.text": "Scope",
      "schedule.responseDeadline": "2026-09-30",
    });
    state.completedNodeIds = ["need", "select-rfx-type", "scope", "requirements", "schedule", "preview"];
    state.items = [{ id: "req-1", nodeId: "requirements", label: "Requirement", createdAt: "2026-08-22T12:00:00.000Z" }];
    expect(publicationPreflight(tree, state).ready).toBe(true);
  });

  it("keeps response submission blocked until response work is complete", () => {
    const responderRoot: RfxWorkflowNode = {
      id: "respond",
      label: "Respond",
      description: "Respond",
      kind: "sequence",
      children: [
        { id: "plan-response", label: "Plan", description: "Plan", kind: "form", fields: [{ id: "plan", label: "Plan", type: "text", required: true }] },
        { id: "draft", label: "Draft", description: "Draft", kind: "form", fields: [{ id: "draft", label: "Draft", type: "textarea", required: true }] },
        { id: "reused-profile-confirmation", label: "Confirm", description: "Confirm", kind: "form", fields: [{ id: "confirm", label: "Confirm", type: "boolean", required: true }] },
        { id: "validate-compliance", label: "Compliance", description: "Compliance", kind: "checklist", checklist: ["Required section complete"] },
        { id: "review", label: "Review", description: "Review", kind: "checklist", checklist: ["Final review complete"] },
      ],
    };
    const state = { ...workspace(), perspective: "responder" as const, entry: "respond" as const, activePath: ["respond"] };
    expect(responsePreflight(responderRoot, state).ready).toBe(false);
  });

  it("provides understandable match and effort summaries", () => {
    const detail = {
      exchangeRecordId: "rfx-test",
      solicitationNumber: "TEST-1",
      rfxType: "RFP" as const,
      source: "external" as const,
      status: "open" as const,
      performanceGeography: "Virginia",
      scope: "Scope",
      deliverables: [],
      requirements: [
        { id: "1", label: "A", kind: "capability" as const, mandatory: true, profileState: "matched" as const },
        { id: "2", label: "B", kind: "capability" as const, mandatory: true, profileState: "confirm" as const },
        { id: "3", label: "C", kind: "documentation" as const, mandatory: true, profileState: "gap" as const },
      ],
      responseRequirements: ["Approach", "Pricing", "References"],
    };
    expect(matchBreakdown(detail)).toEqual({ matched: 1, confirm: 1, gap: 1, total: 3 });
    expect(estimateResponseEffort(detail).label).toBe("Medium");
  });
});
