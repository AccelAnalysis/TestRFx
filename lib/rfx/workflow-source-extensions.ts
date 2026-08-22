import type { RfxWorkflowNode } from "./contracts";
import { issuerWorkflowTree, responderWorkflowTree } from "./workflow-tree";

function find(nodes: RfxWorkflowNode[], id: string): RfxWorkflowNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const nested = node.children ? find(node.children, id) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

function insertUnique(parent: RfxWorkflowNode | undefined, nodes: RfxWorkflowNode[], afterId?: string) {
  if (!parent) return;
  const children = parent.children ?? [];
  const additions = nodes.filter((candidate) => !children.some((existing) => existing.id === candidate.id));
  if (!additions.length) return;
  if (!afterId) {
    parent.children = [...children, ...additions];
    return;
  }
  const index = children.findIndex((child) => child.id === afterId);
  if (index < 0) {
    parent.children = [...children, ...additions];
    return;
  }
  parent.children = [...children.slice(0, index + 1), ...additions, ...children.slice(index + 1)];
}

function applyIssuerExtensions() {
  const requirements = find(issuerWorkflowTree, "requirements");
  if (requirements) {
    requirements.description = "Build requirement cards that tell responders what is required, who it applies to, and what evidence or confirmation is expected.";
    requirements.fields = [
      { id: "requirements.next", label: "Requirement", type: "text", required: true, placeholder: "e.g. Virginia Class A license" },
      { id: "requirements.kind", label: "Requirement kind", type: "select", required: true, options: ["Capability", "Eligibility", "Documentation", "Commercial"] },
      { id: "requirements.priority", label: "How important is it?", type: "select", required: true, options: ["Required", "Preferred"] },
      { id: "requirements.appliesTo", label: "Who must satisfy it?", type: "select", required: true, options: ["Prime / lead responder", "All response team members", "Any qualified team member"] },
      { id: "requirements.evidence", label: "Evidence or confirmation requested", type: "textarea", placeholder: "Describe what responders should provide or confirm." },
    ];
  }

  const reviewApprove = find(issuerWorkflowTree, "review-approve");
  insertUnique(reviewApprove, [
    {
      id: "review-comments",
      label: "Review Comments",
      description: "Record reviewer comments tied to the RFx before approval and publication.",
      kind: "list",
      fields: [
        { id: "reviewComments.reviewer", label: "Reviewer", type: "text", required: true },
        { id: "reviewComments.comment", label: "Comment", type: "textarea", required: true },
      ],
    },
    {
      id: "version-history",
      label: "Version History",
      description: "Track the controlled RFx versions created through drafting, revisions, and addenda.",
      kind: "status",
    },
  ], "collaborators");

  const addenda = find(issuerWorkflowTree, "addenda");
  if (addenda && !addenda.fields?.some((field) => field.id === "addenda.version")) {
    addenda.fields = [
      { id: "addenda.version", label: "Controlled version", type: "number", required: true },
      { id: "addenda.next", label: "Addendum summary", type: "textarea", required: true },
    ];
  }

  const evaluation = find(issuerWorkflowTree, "evaluation");
  insertUnique(evaluation, [
    {
      id: "eligible-response-set",
      label: "Eligible Response Set",
      description: "Establish the administratively eligible response set after close before substantive evaluation begins.",
      kind: "list",
      fields: [
        { id: "eligible.responseId", label: "Response ID", type: "text", required: true },
        { id: "eligible.state", label: "Administrative state", type: "select", required: true, options: ["Eligible", "Incomplete", "Ineligible under RFx rules"] },
        { id: "eligible.note", label: "Administrative note", type: "textarea" },
      ],
    },
    {
      id: "evaluator-assignments",
      label: "Evaluator Assignments",
      description: "Assign evaluators and individual scoring responsibilities according to the issuer's configured governance.",
      kind: "list",
      fields: [
        { id: "evaluator.name", label: "Evaluator", type: "text", required: true },
        { id: "evaluator.responsibility", label: "Scoring responsibility", type: "text", required: true },
      ],
    },
  ], "compliance");

  const individual = find(issuerWorkflowTree, "individual-evaluation");
  if (individual) {
    individual.description = "Score each eligible response against the criteria established before publication, with attributed evaluator comments.";
    individual.fields = [
      { id: "evaluation.evaluator", label: "Evaluator", type: "text", required: true },
      { id: "evaluation.response", label: "Response ID", type: "text", required: true },
      { id: "evaluation.criterion", label: "Evaluation criterion", type: "text", required: true },
      { id: "evaluation.score", label: "Score", type: "number", required: true },
      { id: "evaluation.comment", label: "Evaluator comment", type: "textarea" },
    ];
  }

  insertUnique(evaluation, [
    {
      id: "conflict-declarations",
      label: "Conflict-of-Interest Declarations",
      description: "Record evaluator conflict declarations when the issuer's configured process requires them.",
      kind: "list",
      fields: [
        { id: "conflict.evaluator", label: "Evaluator", type: "text", required: true },
        { id: "conflict.state", label: "Declaration", type: "select", required: true, options: ["No conflict declared", "Potential conflict disclosed", "Recusal required"] },
        { id: "conflict.note", label: "Disclosure / recusal note", type: "textarea" },
      ],
    },
    {
      id: "side-by-side-comparison",
      label: "Side-by-Side Comparison",
      description: "Compare equivalent response elements against the same RFx requirements and evaluation criteria without allowing the platform to choose the winner.",
      kind: "review",
    },
  ], "individual-evaluation");

  insertUnique(evaluation, [
    {
      id: "commercial-negotiation",
      label: "Negotiation / Revised Offers",
      description: "Where the RFx rules permit it, record negotiation, revised offers, or best-and-final submissions as governed extensions of clarification.",
      kind: "list",
      fields: [
        { id: "negotiation.responseId", label: "Response ID", type: "text", required: true },
        { id: "negotiation.mode", label: "Governed step", type: "select", required: true, options: ["Negotiation", "Revised offer", "Best and final offer"] },
        { id: "negotiation.note", label: "Record / instruction", type: "textarea", required: true },
      ],
    },
  ], "clarification");
}

function applyResponderExtensions() {
  const respond = find(responderWorkflowTree, "respond");
  if (!respond?.children) return;

  const fitPrompts: Array<[string, string, string]> = [
    ["fit", "fit.performance", "Can we perform the work?"],
    ["eligibility", "fit.eligibility", "Do we meet the mandatory eligibility requirements?"],
    ["capacity", "fit.capacity", "Do we have capacity for the required schedule?"],
    ["economics", "fit.economics", "Does the opportunity appear economically worthwhile?"],
  ];
  for (const [nodeId, fieldId, label] of fitPrompts) {
    const node = find(responderWorkflowTree, nodeId);
    if (!node) continue;
    node.description = "Make a fast pursuit assessment; add detail only when useful.";
    node.fields = [
      { id: fieldId, label, type: "select", required: true, options: ["Yes", "Unsure", "No"] },
      { id: `${fieldId}.note`, label: "Optional note", type: "textarea", placeholder: "Add context only if it helps the decision." },
    ];
  }

  const draftIndex = respond.children.findIndex((node) => node.id === "draft");
  if (draftIndex >= 0 && !respond.children.some((node) => node.id === "reused-profile-confirmation")) {
    respond.children.splice(draftIndex + 1, 0, {
      id: "reused-profile-confirmation",
      label: "Confirm Reused Organization Data",
      description: "Review and explicitly confirm any capability-profile or document-library information reused in the response so stale information is not silently submitted.",
      kind: "checklist",
      checklist: [
        "Reused organization information reviewed",
        "Capability/profile information confirmed current",
        "Reused document references confirmed current",
      ],
    });
  }

  const plan = find(responderWorkflowTree, "plan-response");
  if (plan) {
    plan.label = "Plan Response / Requirements Matrix";
    plan.description = "Turn issuer requirements into a response plan and compliance matrix with an owner and completion state for every required element.";
    plan.fields = [
      { id: "responsePlan.next", label: "Requirement / response component", type: "text", required: true },
      { id: "responsePlan.owner", label: "Owner", type: "text" },
      { id: "responsePlan.state", label: "State", type: "select", required: true, options: ["Not started", "In progress", "Complete"] },
    ];
  }

  const collaborate = find(responderWorkflowTree, "collaborate");
  if (collaborate) {
    collaborate.kind = "group";
    collaborate.fields = undefined;
    collaborate.children = [
      {
        id: "assign-sections",
        label: "Assign Sections",
        description: "Assign response sections to internal or external collaborators.",
        kind: "list",
        fields: [
          { id: "collab.section", label: "Section", type: "text", required: true },
          { id: "collab.assignee", label: "Assignee", type: "text", required: true },
          { id: "collab.sectionState", label: "State", type: "select", required: true, options: ["Assigned", "In progress", "Ready for review", "Complete"] },
        ],
      },
      {
        id: "request-information",
        label: "Request Information",
        description: "Request information needed from response teammates or internal contributors.",
        kind: "list",
        fields: [
          { id: "collab.requestFrom", label: "Requested from", type: "text", required: true },
          { id: "collab.request", label: "Information requested", type: "textarea", required: true },
          { id: "collab.requestState", label: "State", type: "select", required: true, options: ["Requested", "Received", "Resolved"] },
        ],
      },
      {
        id: "response-responsibilities",
        label: "Responsibilities",
        description: "Establish response responsibilities for the team.",
        kind: "list",
        fields: [
          { id: "collab.person", label: "Person / organization", type: "text", required: true },
          { id: "collab.responsibility", label: "Responsibility", type: "text", required: true },
        ],
      },
      {
        id: "document-references",
        label: "Documents",
        description: "Track response document references and the teammate or section they support.",
        kind: "list",
        fields: [
          { id: "collab.document", label: "Document / storage reference", type: "text", required: true },
          { id: "collab.documentContext", label: "Section / context", type: "text" },
        ],
      },
      {
        id: "track-collaboration-completion",
        label: "Track Completion",
        description: "Track collaboration completion without conflating workflow participation with a legal teaming agreement.",
        kind: "list",
        fields: [
          { id: "collab.task", label: "Task / component", type: "text", required: true },
          { id: "collab.state", label: "State", type: "select", required: true, options: ["Assigned", "In progress", "Complete"] },
        ],
      },
    ];
  }
}

let applied = false;
export function applySourceWorkflowExtensions() {
  if (applied) return;
  applied = true;
  applyIssuerExtensions();
  applyResponderExtensions();
}

applySourceWorkflowExtensions();
