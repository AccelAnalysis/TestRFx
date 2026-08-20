import type { RfxWorkflowEntry, RfxWorkflowNode, RfxWorkflowPerspective } from "./contracts";

const text = (id: string, label: string, required = false, placeholder?: string) => ({ id, label, type: "text" as const, required, placeholder });
const area = (id: string, label: string, required = false, placeholder?: string) => ({ id, label, type: "textarea" as const, required, placeholder });
const select = (id: string, label: string, options: string[], required = false) => ({ id, label, type: "select" as const, options, required });
const date = (id: string, label: string, required = false) => ({ id, label, type: "date" as const, required });
const number = (id: string, label: string, required = false) => ({ id, label, type: "number" as const, required });

export const issuerWorkflowTree: RfxWorkflowNode[] = [
  {
    id: "create",
    label: "Create RFx / Opportunity",
    description: "Define a need, structure the request, validate it, and publish one canonical RFx object.",
    kind: "group",
    children: [
      {
        id: "define-need",
        label: "Define Need",
        description: "Start with what the organization needs rather than a document type.",
        kind: "group",
        children: [
          {
            id: "need",
            label: "What do you need?",
            description: "Describe the business problem, product, service, capability, supplier, partner, or information being sought.",
            kind: "form",
            fields: [area("need.statement", "Need statement", true, "Describe the problem or result the organization needs."), text("need.owner", "Internal owner")],
          },
          {
            id: "starting-point",
            label: "Starting Point",
            description: "Choose the source-defined way to begin the RFx.",
            kind: "decision",
            fields: [select("need.startingPoint", "Start from", ["Blank RFx", "Template", "Previous RFx", "Guided drafting"], true)],
          },
          {
            id: "select-rfx-type",
            label: "Select RFx Type",
            description: "Choose the final request form. The platform may guide the choice, but the issuer remains responsible for it.",
            kind: "decision",
            fields: [select("need.rfxType", "RFx type", ["RFI", "RFQ", "RFP", "Sources Sought", "Supplier Request", "Subcontractor Request", "Service Request", "Product Request", "Partner Request"], true)],
          },
        ],
      },
      {
        id: "build-scope",
        label: "Build Scope",
        description: "Translate the need into modular scope, deliverables, requirements, schedule, commercial terms, and capability criteria.",
        kind: "group",
        children: [
          { id: "scope", label: "Scope", description: "Define the scope of work or specifications.", kind: "form", fields: [area("scope.summary", "Scope of work / specifications", true), text("scope.serviceLocations", "Service locations"), number("scope.quantity", "Quantity") ] },
          { id: "deliverables", label: "Deliverables", description: "Define what the selected organization must provide.", kind: "list", fields: [text("deliverables.next", "Add deliverable", true)] },
          { id: "requirements", label: "Requirements", description: "Capture mandatory and supporting requirements, including licenses, certifications, insurance, qualifications, geography, and documentation.", kind: "list", fields: [text("requirements.next", "Add requirement", true), select("requirements.kind", "Requirement kind", ["Capability", "Eligibility", "Documentation", "Commercial"], true), select("requirements.mandatory", "Mandatory?", ["Yes", "No"], true)] },
          { id: "schedule", label: "Schedule", description: "Define dates, performance period, Q&A timing, and response deadline.", kind: "form", fields: [date("schedule.issueDate", "Issue date"), date("schedule.qaDeadline", "Q&A deadline"), date("schedule.responseDeadline", "Response deadline", true), text("schedule.contractPeriod", "Contract / performance period")] },
          { id: "commercial-terms", label: "Commercial Terms", description: "Capture budget or estimated value and other commercial information when appropriate.", kind: "form", fields: [text("commercial.estimatedValue", "Budget / estimated value"), area("commercial.terms", "Commercial terms")] },
          { id: "capability-criteria", label: "Define Who Is Needed", description: "Describe the capabilities and structured attributes actually required, not only classification codes.", kind: "list", fields: [text("capabilities.next", "Required capability / attribute", true), text("capabilities.geography", "Service geography / distance"), text("capabilities.capacity", "Minimum capacity") ] },
        ],
      },
      {
        id: "understand-market",
        label: "Understand Market",
        description: "Inspect potential market coverage before publication without turning matching into qualification or award prediction.",
        kind: "group",
        children: [
          { id: "potential-matches", label: "Potential Matches", description: "Review organizations surfaced from structured requirements and capability profiles.", kind: "status" },
          { id: "required-criteria", label: "Required Criteria Coverage", description: "Review which organizations appear to meet the structured required criteria.", kind: "status" },
          { id: "service-geography", label: "Service Geography", description: "Review the geographic subset relevant to performance or service coverage.", kind: "status" },
          { id: "profile-completeness", label: "Profile Completeness", description: "Distinguish potentially matching organizations whose profiles contain enough information to assess the request.", kind: "status" },
        ],
      },
      {
        id: "establish-evaluation",
        label: "Establish Evaluation",
        description: "Define how responses will be evaluated before publication.",
        kind: "group",
        children: [
          { id: "evaluation-criteria", label: "Evaluation Criteria", description: "Define issuer criteria such as price, technical approach, experience, schedule, qualifications, capacity, past performance, service ability, and certifications as applicable.", kind: "list", fields: [text("evaluation.next", "Add evaluation criterion", true), number("evaluation.weight", "Weight (when used)")] },
          { id: "evaluation-governance", label: "Evaluation Governance", description: "Choose an evaluation structure appropriate to the RFx type; formal criteria may be weighted and locked at publication while informal requests can remain simpler.", kind: "form", fields: [select("evaluation.mode", "Evaluation mode", ["Simple", "Weighted / formal"], true), area("evaluation.notes", "Evaluation instructions")] },
        ],
      },
      {
        id: "assemble",
        label: "Assemble RFx Package",
        description: "Maintain structured components as the canonical RFx and generate a human-readable package from them.",
        kind: "group",
        children: [
          { id: "overview", label: "Overview", description: "Review the RFx overview generated from structured data.", kind: "review" },
          { id: "package-scope", label: "Scope", description: "Review the package scope component.", kind: "review" },
          { id: "package-requirements", label: "Requirements", description: "Review structured requirements.", kind: "review" },
          { id: "package-deliverables", label: "Deliverables", description: "Review required deliverables.", kind: "review" },
          { id: "package-schedule", label: "Schedule", description: "Review dates and performance schedule.", kind: "review" },
          { id: "package-commercial", label: "Commercial Information", description: "Review applicable commercial information.", kind: "review" },
          { id: "package-evaluation", label: "Evaluation", description: "Review evaluation criteria and method.", kind: "review" },
          { id: "attachments", label: "Attachments", description: "Track package attachments and their accessibility.", kind: "list", fields: [text("attachments.next", "Attachment name"), text("attachments.url", "Attachment URL / storage reference")] },
          { id: "terms", label: "Terms", description: "Capture RFx terms that apply to the request.", kind: "form", fields: [area("package.terms", "Terms")] },
          { id: "response-instructions", label: "Response Instructions", description: "Define what responders must submit and how.", kind: "form", fields: [area("package.responseInstructions", "Response instructions", true)] },
        ],
      },
      {
        id: "review-approve",
        label: "Review / Approve",
        description: "Coordinate internal collaboration, versioned review, requested revisions, approvals, and publication readiness.",
        kind: "group",
        children: [
          { id: "collaborators", label: "Collaborators", description: "Assign source-defined collaboration roles.", kind: "list", fields: [text("collaborators.next", "Collaborator name / email", true), select("collaborators.role", "Role", ["Drafter", "Technical reviewer", "Procurement reviewer", "Legal reviewer", "Approver", "Evaluator"], true)] },
          { id: "requested-revisions", label: "Requested Revisions", description: "Record requested revisions and review comments.", kind: "list", fields: [area("revisions.next", "Requested revision / comment", true)] },
          { id: "approval-gates", label: "Approval Gates", description: "Track approvals that the issuing organization requires before publication.", kind: "checklist", checklist: ["Technical review complete", "Procurement review complete when required", "Legal review complete when required", "Approver authorization complete when required"] },
          { id: "publication-readiness", label: "Publication Readiness", description: "Confirm internal collaboration and approval work is ready for final validation.", kind: "checklist", checklist: ["Required reviews resolved", "Required approvals complete", "Current version selected for publication"] },
        ],
      },
      {
        id: "pre-publication-validation",
        label: "Pre-Publication Validation",
        description: "Catch incomplete or contradictory RFx data before release.",
        kind: "checklist",
        checklist: ["Required information complete", "Dates valid", "Evaluation defined", "Response requirements defined", "Attachments accessible", "Geography defined", "Issuer authority established", "Required approvals complete", "Q&A and response dates do not conflict"],
      },
      { id: "preview", label: "Preview", description: "Review exactly what responders will see before publishing.", kind: "review" },
      {
        id: "publish",
        label: "Publish",
        description: "Publish the structured RFx, activate discovery, geography, timeline, matching, search, notifications, and the auditable lifecycle.",
        kind: "decision",
        fields: [select("publish.confirmation", "Publication decision", ["Keep as draft", "Publish RFx"], true)],
      },
    ],
  },
  {
    id: "manage",
    label: "Manage RFx",
    description: "Manage a draft or published organization-owned RFx through Q&A, responses, evaluation, decision, and outcome.",
    kind: "group",
    children: [
      { id: "overview-status", label: "Overview / Status", description: "Review current RFx lifecycle state, dates, ownership, and activity.", kind: "status" },
      { id: "draft-save-publish", label: "Draft / Save / Publish", description: "Manage the source-defined draft, save, and publish lifecycle for the RFx.", kind: "decision", fields: [select("manage.lifecycleAction", "Lifecycle action", ["Save draft", "Publish", "Update published RFx"], true)] },
      {
        id: "qa-addenda",
        label: "Q&A / Addenda",
        description: "Manage structured questions, answers, material changes, controlled versions, and acknowledgements.",
        kind: "group",
        children: [
          { id: "questions", label: "Questions", description: "Review responder questions structured against the RFx.", kind: "list" },
          { id: "answers", label: "Answers", description: "Answer privately or publish to all according to the RFx rules.", kind: "form", fields: [text("qa.questionId", "Question ID"), area("qa.answer", "Answer"), select("qa.visibility", "Visibility", ["Private response", "Publish to all"], true)] },
          { id: "addenda", label: "Addenda", description: "Issue a controlled RFx version when an answer or change materially modifies the request.", kind: "list", fields: [area("addenda.next", "Addendum summary", true)] },
          { id: "acknowledgements", label: "Acknowledgements", description: "Track responder acknowledgement when the RFx rules require it.", kind: "status" },
        ],
      },
      {
        id: "responses-matches",
        label: "View Responses / Matches",
        description: "Review matching organizations and response participation without exposing private drafting activity.",
        kind: "group",
        children: [
          { id: "potential-matches", label: "Potential Matches", description: "Review organizations surfaced from the structured requirements.", kind: "status" },
          { id: "invited", label: "Invited Organizations", description: "Review organizations explicitly invited by the issuer.", kind: "list" },
          { id: "received", label: "Received Responses", description: "Review eligible submitted responses after the RFx rules permit access.", kind: "list" },
        ],
      },
      {
        id: "evaluation",
        label: "Evaluate",
        description: "Organize issuer evaluation without allowing the platform to choose the winner.",
        kind: "group",
        children: [
          { id: "compliance", label: "Compliance", description: "Check administrative completeness and establish the eligible response set.", kind: "checklist", checklist: ["Required response components present", "Required acknowledgements present", "Required attachments present"] },
          { id: "individual-evaluation", label: "Individual Evaluation", description: "Assign evaluators and record scoring/comments against the criteria established before publication.", kind: "list", fields: [text("evaluation.evaluator", "Evaluator"), text("evaluation.response", "Response ID"), area("evaluation.comment", "Evaluation comment")] },
          { id: "clarification", label: "Clarification", description: "Request and record clarification where the RFx rules allow it.", kind: "list", fields: [text("clarification.responseId", "Response ID"), area("clarification.request", "Clarification request", true)] },
          { id: "consensus", label: "Consensus", description: "Record consensus discussion and results where used.", kind: "form", fields: [area("evaluation.consensus", "Consensus record")] },
          { id: "recommendation", label: "Recommendation", description: "Record the recommendation produced by the issuer's evaluation process.", kind: "form", fields: [area("evaluation.recommendation", "Recommendation")] },
          { id: "approval", label: "Approval", description: "Record required approval of the recommendation according to issuer governance.", kind: "decision", fields: [select("evaluation.approval", "Approval state", ["Pending", "Approved", "Returned for revision"], true)] },
        ],
      },
      {
        id: "decision-next-step",
        label: "Decision / Next Step",
        description: "Use the source-defined next-step actions after evaluation or management review.",
        kind: "group",
        children: [
          { id: "update", label: "Update", description: "Update permitted RFx information or status.", kind: "form", fields: [area("decision.update", "Update note", true)] },
          { id: "close", label: "Close", description: "Close the RFx according to the issuer's process.", kind: "decision", fields: [select("decision.close", "Close state", ["Keep open", "Close RFx", "Cancel RFx"], true)] },
          { id: "select-award-connect", label: "Select / Award / Connection", description: "Record the conclusion appropriate to the RFx type without claiming legal award authority that belongs to an external system.", kind: "form", fields: [select("decision.outcomeType", "Outcome", ["Market information received", "Capable suppliers identified", "Supplier selected", "Award / selection", "Teaming / subcontract connection", "Provider selected"], true), text("decision.selectedOrganization", "Selected / connected organization"), text("decision.externalReference", "External award / decision reference")] },
          { id: "advance", label: "Advance", description: "Advance the RFx to its next permitted lifecycle state.", kind: "decision", fields: [select("decision.advance", "Advance to", ["Evaluation", "Clarification", "Selected / awarded", "Execution / relationship", "Completed"], true)] },
          { id: "refer-context", label: "Refer from Context", description: "Create a referral tied to this RFx context.", kind: "handoff", handoff: "referrals", fields: [text("referral.organization", "Organization to refer", true), area("referral.note", "Referral context")] },
        ],
      },
      {
        id: "post-rfx-outcome",
        label: "Post-RFx Outcome",
        description: "Continue far enough to understand whether the connection produced economic activity without turning RFxchange into an ERP.",
        kind: "group",
        children: [
          { id: "relationship-initiated", label: "Contract / Relationship Initiated", description: "Record that the selected relationship began.", kind: "status" },
          { id: "work-underway", label: "Work Underway", description: "Record that performance or the relationship is underway.", kind: "status" },
          { id: "completed", label: "Completed", description: "Record completion of the RFx-linked activity.", kind: "status" },
          { id: "outcome-reported", label: "Outcome Reported", description: "Record economic-activity outcome information permitted by the participants.", kind: "form", fields: [text("outcome.value", "Reported contract / activity value"), area("outcome.summary", "Outcome summary", true), select("outcome.performance", "Performance state", ["Completed", "Partially completed", "Cancelled / did not proceed"], true)] },
        ],
      },
    ],
  },
  {
    id: "invite-team",
    label: "Invite Team / Collaborators",
    description: "Invite and assign collaborators without treating an invitation as legal procurement authority by itself.",
    kind: "group",
    children: [
      { id: "internal-collaborators", label: "Internal Collaborators", description: "Assign the source-defined issuer collaboration roles.", kind: "list", fields: [text("issuerTeam.person", "Name / email", true), select("issuerTeam.role", "Role", ["Drafter", "Technical reviewer", "Procurement reviewer", "Legal reviewer", "Approver", "Evaluator"], true)] },
      { id: "invite", label: "Create Invitation", description: "Create a collaboration invitation associated with this RFx.", kind: "form", fields: [text("issuerTeam.invitee", "Invitee", true), area("issuerTeam.message", "Message")] },
      { id: "responsibilities", label: "Responsibilities", description: "Record assigned responsibilities for the RFx collaboration.", kind: "list", fields: [text("issuerTeam.responsibility", "Responsibility", true)] },
    ],
  },
  {
    id: "track-status",
    label: "Track / Watch Status",
    description: "Track the RFx lifecycle, deadline, changes, Q&A/addenda, and response activity available to the issuer.",
    kind: "status",
  },
];

export const responderWorkflowTree: RfxWorkflowNode[] = [
  {
    id: "view",
    label: "View RFx Detail",
    description: "Understand the opportunity before deciding whether to pursue it.",
    kind: "group",
    children: [
      { id: "what-is-this", label: "What is this?", description: "Review the request type, issuer, scope, dates, value where available, geography, requirements, evaluation method, and authoritative source.", kind: "review" },
      { id: "why-seeing", label: "Why am I seeing it?", description: "Review whether the RFx was discovered, surfaced as a potential match, or sent by invitation. None of these states means qualified or endorsed.", kind: "status" },
      { id: "can-pursue", label: "Can I pursue it?", description: "Review mandatory requirements and the current organization profile before making a go/no-go decision.", kind: "review" },
      { id: "pursuit-requirements", label: "What will pursuing require?", description: "Review response components, teaming needs, gaps, dates, and evaluation context.", kind: "review" },
    ],
  },
  {
    id: "respond",
    label: "Respond / Submit",
    description: "Move from fit assessment through response, submission, decision, execution, and outcome on the same RFx object.",
    kind: "group",
    children: [
      {
        id: "assess-fit",
        label: "Assess Fit",
        description: "Evaluate fit, eligibility, capacity, economics, competition, and gaps before committing response effort.",
        kind: "group",
        children: [
          { id: "fit", label: "Fit", description: "Can the organization perform the work?", kind: "form", fields: [area("fit.performance", "Fit assessment", true)] },
          { id: "eligibility", label: "Eligibility", description: "Does the organization satisfy mandatory requirements?", kind: "form", fields: [area("fit.eligibility", "Eligibility assessment", true)] },
          { id: "capacity", label: "Capacity", description: "Can the organization perform on the required schedule?", kind: "form", fields: [area("fit.capacity", "Capacity assessment", true)] },
          { id: "economics", label: "Economics", description: "Is the opportunity worth pursuing?", kind: "form", fields: [area("fit.economics", "Economic assessment", true)] },
          { id: "competition", label: "Competition", description: "Record what can legitimately be understood about the market.", kind: "form", fields: [area("fit.competition", "Market / competition notes")] },
          { id: "gaps", label: "Gaps", description: "Identify missing capability, documentation, qualification, geography, or capacity needed for pursuit.", kind: "list", fields: [text("gaps.next", "Gap", true)] },
        ],
      },
      {
        id: "go-no-go",
        label: "Go / No-Go",
        description: "Choose Pursue, Watch, or Decline after the fit assessment.",
        kind: "decision",
        fields: [select("decision.goNoGo", "Decision", ["Pursue", "Watch", "Decline"], true), select("decision.declineReason", "Decline reason", ["Schedule", "Capacity", "Geography", "Qualification", "Scope", "Economics", "Other"]), area("decision.note", "Decision note")],
      },
      {
        id: "resolve-gaps",
        label: "Resolve Gaps",
        description: "Use the Exchange to close readiness gaps rather than ending the pursuit at a missing capability.",
        kind: "group",
        children: [
          { id: "find-teammate", label: "Find a Teammate", description: "Search Exchange organizations capable of filling an identified capability gap.", kind: "handoff", handoff: "capabilities" },
          { id: "find-resource", label: "Find a Resource", description: "Find relevant assistance such as procurement support, financing, workforce, certification guidance, or another appropriate provider while preserving RFx context.", kind: "handoff", handoff: "resources" },
        ],
      },
      {
        id: "build-team",
        label: "Build Team",
        description: "Form an RFx response team while keeping business collaboration distinct from a legal agreement.",
        kind: "group",
        children: [
          { id: "discover", label: "Discover", description: "Identify potential teammates from Exchange capability records.", kind: "handoff", handoff: "capabilities" },
          { id: "discuss", label: "Discuss", description: "Record the teaming discussion and open questions.", kind: "list", fields: [text("team.organization", "Organization", true), area("team.discussion", "Discussion note", true)] },
          { id: "invite", label: "Invite", description: "Create a response-team invitation.", kind: "form", fields: [text("team.invitee", "Organization / contact", true), area("team.inviteMessage", "Invitation message")] },
          { id: "agree-externally", label: "Agree Externally", description: "Record the status of any external legal/commercial teaming agreement; RFxchange does not create the legal relationship by button click.", kind: "form", fields: [select("team.agreementState", "External agreement state", ["Not started", "In discussion", "Agreed externally"], true), text("team.agreementReference", "External agreement reference")] },
          { id: "participate", label: "Participate in Response", description: "Add confirmed teammates to response responsibilities and sections.", kind: "list", fields: [text("team.participant", "Team participant", true), text("team.responsibility", "Responsibility / section", true)] },
        ],
      },
      {
        id: "plan-response",
        label: "Plan Response",
        description: "Turn issuer requirements into a response plan with completion state.",
        kind: "list",
        fields: [text("responsePlan.next", "Response component / requirement", true), select("responsePlan.state", "State", ["Not started", "In progress", "Complete"], true)],
      },
      {
        id: "draft",
        label: "Draft",
        description: "Draft the required response components and confirm any reused organization information before submission.",
        kind: "form",
        fields: [area("response.draft", "Response draft / working content", true)],
      },
      {
        id: "collaborate",
        label: "Collaborate",
        description: "Assign sections, request information, establish responsibilities, manage document references, and track completion.",
        kind: "list",
        fields: [text("response.assignment", "Section / responsibility", true), text("response.assignee", "Assignee", true), select("response.assignmentState", "State", ["Assigned", "In progress", "Complete"], true)],
      },
      {
        id: "qa-addenda",
        label: "Q&A / Addenda",
        description: "Ask structured questions and keep the response aligned with controlled RFx versions.",
        kind: "group",
        children: [
          { id: "submit-question", label: "Submit Question", description: "Submit a question structured against the RFx.", kind: "form", fields: [area("responderQa.question", "Question", true)] },
          { id: "answers", label: "View Answers", description: "Review answers the issuer made available under the RFx rules.", kind: "list" },
          { id: "acknowledge-addenda", label: "Acknowledge Addenda", description: "Acknowledge applicable addenda when required before submission.", kind: "checklist", checklist: ["Review current addenda", "Acknowledge each required addendum"] },
        ],
      },
      {
        id: "validate-compliance",
        label: "Validate Compliance",
        description: "Evaluate administrative completeness without predicting the chance of winning.",
        kind: "checklist",
        checklist: ["All required response components complete", "Pricing complete when required", "Required licenses / certifications confirmed", "Required attachments present", "Required addenda acknowledged"],
      },
      {
        id: "review",
        label: "Review",
        description: "Review the final assembled response before submission.",
        kind: "checklist",
        checklist: ["Response package reviewed", "Pricing reviewed", "Attachments reviewed", "Team members confirmed", "Representations / acknowledgements confirmed", "Addenda acknowledgement confirmed"],
      },
      {
        id: "submit",
        label: "Submit",
        description: "Submit through RFxchange when the RFx is hosted here, or route to the authoritative external system when required.",
        kind: "group",
        children: [
          { id: "hosted-submission", label: "RFxchange-Hosted Submission", description: "Timestamp and lock the submitted response, preserving an immutable receipt/version when the RFx is hosted by RFxchange.", kind: "decision", fields: [select("submission.hostedDecision", "Submission decision", ["Continue drafting", "Submit final response"], true)] },
          { id: "external-submission", label: "External Submission", description: "Prepare the response here and hand off to the issuer's authoritative submission channel without falsely recording formal submission.", kind: "handoff", handoff: "external-submission", fields: [text("submission.externalReference", "External confirmation / reference after submission")] },
        ],
      },
      { id: "clarify", label: "Clarify", description: "Respond to issuer clarification requests or permitted negotiation/revised-offer steps according to RFx governance.", kind: "list", fields: [text("responderClarification.requestId", "Clarification request ID"), area("responderClarification.response", "Clarification response")] },
      { id: "decision", label: "Decision", description: "Track the decision state communicated by the issuer without allowing RFxchange to manufacture an award decision.", kind: "status" },
      { id: "execute", label: "Execute", description: "Track the selected relationship from initiation into work underway and completion.", kind: "decision", fields: [select("execution.state", "Execution state", ["Relationship initiated", "Work underway", "Completed"], true)] },
      { id: "report-outcome", label: "Report Outcome", description: "Report the RFx-linked outcome that can feed permitted economic intelligence.", kind: "form", fields: [text("responderOutcome.value", "Reported activity / contract value"), area("responderOutcome.summary", "Outcome summary", true)] },
    ],
  },
  {
    id: "team",
    label: "Team / Join / Collaborate",
    description: "Fast entry into the same source-defined teaming sequence used inside the response workflow.",
    kind: "group",
    children: [
      { id: "discover", label: "Discover", description: "Identify potential teammates from Exchange capabilities.", kind: "handoff", handoff: "capabilities" },
      { id: "discuss", label: "Discuss", description: "Record a teaming discussion.", kind: "list", fields: [text("quickTeam.organization", "Organization", true), area("quickTeam.note", "Discussion note")] },
      { id: "invite", label: "Invite", description: "Create a teaming invitation for this RFx.", kind: "form", fields: [text("quickTeam.invitee", "Organization / contact", true), area("quickTeam.message", "Invitation message")] },
      { id: "agree-externally", label: "Agree Externally", description: "Record external agreement status without implying RFxchange created a legal relationship.", kind: "form", fields: [select("quickTeam.agreement", "External agreement state", ["Not started", "In discussion", "Agreed externally"], true)] },
      { id: "participate", label: "Participate in Response", description: "Record response participation and responsibility.", kind: "list", fields: [text("quickTeam.participant", "Participant", true), text("quickTeam.responsibility", "Responsibility", true)] },
    ],
  },
  { id: "watch", label: "Watch / Follow", description: "Persist this RFx in the responder watch state and track relevant lifecycle changes.", kind: "status" },
  {
    id: "refer",
    label: "Refer Relevant Organization",
    description: "Create a referral tied to this RFx context while referral management remains cross-lens.",
    kind: "handoff",
    handoff: "referrals",
    fields: [text("responderReferral.organization", "Organization to refer", true), area("responderReferral.note", "Referral context")],
  },
  {
    id: "outcome",
    label: "Outcome",
    description: "Review the source-defined responder relationship outcomes for this RFx.",
    kind: "status",
  },
];

export const rfxContextActionTree: RfxWorkflowNode[] = [
  { id: "context-view", label: "View", description: "Open the RFx detail surface.", kind: "review" },
  { id: "context-match", label: "Match", description: "Review structured capability-match context without treating it as qualification or endorsement.", kind: "status" },
  { id: "context-refer", label: "Refer", description: "Create a referral from the current RFx context.", kind: "handoff", handoff: "referrals", fields: [text("contextReferral.organization", "Organization to refer", true), area("contextReferral.note", "Referral context")] },
  { id: "context-save", label: "Save", description: "Persist the RFx in the current workspace watch/save state.", kind: "status" },
];

export function workflowTreeFor(perspective: RfxWorkflowPerspective) {
  return perspective === "issuer" ? issuerWorkflowTree : responderWorkflowTree;
}

export function perspectiveForEntry(entry: RfxWorkflowEntry): RfxWorkflowPerspective {
  return entry === "create-rfx" || entry === "manage-rfx" || entry === "invite-team" ? "issuer" : "responder";
}

export function rootForEntry(entry: RfxWorkflowEntry) {
  if (entry === "create-rfx") return "create";
  if (entry === "manage-rfx") return "manage";
  if (entry === "invite-team") return "invite-team";
  if (entry === "respond") return "respond";
  if (entry === "team") return "team";
  return "view";
}

export function findWorkflowNode(nodes: RfxWorkflowNode[], path: string[]): RfxWorkflowNode | undefined {
  let level = nodes;
  let current: RfxWorkflowNode | undefined;
  for (const id of path) {
    current = level.find((node) => node.id === id);
    if (!current) return undefined;
    level = current.children ?? [];
  }
  return current;
}

export function workflowBreadcrumbs(nodes: RfxWorkflowNode[], path: string[]) {
  const crumbs: RfxWorkflowNode[] = [];
  let level = nodes;
  for (const id of path) {
    const node = level.find((item) => item.id === id);
    if (!node) break;
    crumbs.push(node);
    level = node.children ?? [];
  }
  return crumbs;
}
