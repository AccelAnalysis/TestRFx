export type RegistrationNodeKind = "section" | "workflow" | "task" | "decision" | "handoff";

export type RegistrationWorkflowNode = {
  id: string;
  label: string;
  description: string;
  kind: RegistrationNodeKind;
  path: readonly string[];
  children?: readonly RegistrationWorkflowNode[];
};

export const registrationWorkflowTree: readonly RegistrationWorkflowNode[] = [
  {
    id: "entry-context",
    label: "Entry context",
    description: "Preserve how the participant arrived before identity creation.",
    kind: "section",
    path: ["entry-context"],
    children: [
      {
        id: "website-landing",
        label: "Website / landing page",
        description: "Direct Public / Acquisition handoff into Registration.",
        kind: "task",
        path: ["entry-context", "website-landing"],
      },
      {
        id: "campaign-referral",
        label: "Campaign / referral link",
        description: "Retain campaign or referring-party context through onboarding.",
        kind: "task",
        path: ["entry-context", "campaign-referral"],
      },
      {
        id: "partner-invitation",
        label: "Partner / invitation",
        description: "Retain organization invitation context without granting membership yet.",
        kind: "task",
        path: ["entry-context", "partner-invitation"],
      },
      {
        id: "event-qr",
        label: "QR code / event / promo",
        description: "Retain event or promotion source context when supplied.",
        kind: "task",
        path: ["entry-context", "event-qr"],
      },
    ],
  },
  {
    id: "create-account",
    label: "Create account",
    description: "Capture the person-level RFxchange identity.",
    kind: "workflow",
    path: ["create-account"],
    children: [
      {
        id: "name",
        label: "Name",
        description: "Enter the account holder's first and last name.",
        kind: "task",
        path: ["create-account", "name"],
      },
      {
        id: "email",
        label: "Email address",
        description: "Enter the canonical account email used for identity resolution.",
        kind: "task",
        path: ["create-account", "email"],
      },
      {
        id: "auth-method",
        label: "Authentication method",
        description: "Use RFxchange's passwordless email-verification method defined by the Login architecture.",
        kind: "task",
        path: ["create-account", "auth-method"],
      },
      {
        id: "security-privacy",
        label: "Security & privacy",
        description: "Acknowledge Terms and Privacy; keep marketing consent separate and optional.",
        kind: "task",
        path: ["create-account", "security-privacy"],
      },
      {
        id: "review",
        label: "Review & create",
        description: "Validate the identity and create or resume the durable registration transaction.",
        kind: "task",
        path: ["create-account", "review"],
      },
    ],
  },
  {
    id: "identity-resolution",
    label: "Identity resolution",
    description: "Apply duplicate detection before creating another account.",
    kind: "decision",
    path: ["identity-resolution"],
    children: [
      {
        id: "new-account",
        label: "New account",
        description: "Create a pending identity and continue to verification.",
        kind: "task",
        path: ["identity-resolution", "new-account"],
      },
      {
        id: "existing-account",
        label: "Existing account",
        description: "Route an already verified identity to Login instead of duplicating it.",
        kind: "handoff",
        path: ["identity-resolution", "existing-account"],
      },
      {
        id: "pending-verification",
        label: "Pending verification",
        description: "Resume the existing pending account and verification challenge.",
        kind: "handoff",
        path: ["identity-resolution", "pending-verification"],
      },
    ],
  },
  {
    id: "verify-email",
    label: "Verify email / access",
    description: "Account Verification owns proof of control of the registration email.",
    kind: "handoff",
    path: ["verify-email"],
    children: [
      {
        id: "send",
        label: "Send verification",
        description: "Issue a single-use verification challenge and deliver it by transactional email.",
        kind: "task",
        path: ["verify-email", "send"],
      },
      {
        id: "verification-link",
        label: "Verification link",
        description: "Open and validate the delivered one-time verification link.",
        kind: "handoff",
        path: ["verify-email", "verification-link"],
      },
      {
        id: "resend",
        label: "Resend verification",
        description: "Supersede the prior challenge and send a new link subject to cooldown policy.",
        kind: "handoff",
        path: ["verify-email", "resend"],
      },
      {
        id: "change-email",
        label: "Change email address",
        description: "Resolve duplicate email rules, update the pending identity, and send a new challenge.",
        kind: "handoff",
        path: ["verify-email", "change-email"],
      },
    ],
  },
];

export function flattenRegistrationWorkflow(nodes = registrationWorkflowTree): RegistrationWorkflowNode[] {
  return nodes.flatMap((node) => [node, ...(node.children ? flattenRegistrationWorkflow(node.children) : [])]);
}

export function findRegistrationWorkflowNode(path: readonly string[]) {
  return flattenRegistrationWorkflow().find(
    (node) => node.path.length === path.length && node.path.every((part, index) => part === path[index]),
  );
}

export const registrationWorkflowPaths = flattenRegistrationWorkflow()
  .filter((node) => node.path.length > 0)
  .map((node) => [...node.path]);
