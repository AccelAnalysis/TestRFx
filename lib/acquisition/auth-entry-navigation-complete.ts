import {
  type AuthEntryNode,
  type AuthEntryResolvedNode,
  authEntryNodeHref,
  authEntryTree as baseAuthEntryTree,
  resolveAuthEntryDestination,
} from "./auth-entry-navigation";

const loginSourceSupport: AuthEntryNode[] = [
  {
    id: "magic-link-notes",
    label: "Magic Link Notes",
    summary: "Source-defined properties of the Login magic-link challenge.",
    kind: "supporting",
    source: "Login source",
    children: [
      { id: "one-time-use", label: "One-Time Use", summary: "Each sign-in link can be used once.", kind: "supporting", source: "Login source" },
      { id: "expires-15-minutes", label: "Expires in 15 Minutes", summary: "The source fixes the sign-in link lifetime at 15 minutes.", kind: "supporting", source: "Login source" },
      { id: "secure-passwordless", label: "Secure & Passwordless", summary: "The source positions the sign-in challenge as passwordless authentication.", kind: "supporting", source: "Login source" },
      { id: "works-all-devices", label: "Works on All Devices", summary: "The same one-time challenge is intended to work across supported devices.", kind: "supporting", source: "Login source" },
    ],
  },
  {
    id: "failed-login-outcomes",
    label: "Failed Login Outcomes",
    summary: "Failure states explicitly shown in the Login source.",
    kind: "supporting",
    source: "Login source",
    children: [
      { id: "email-not-found", label: "Email Not Found", summary: "Offer Registration or return safely to the public site.", kind: "supporting", source: "Login source" },
      { id: "link-expired", label: "Magic Link Expired", summary: "Request a replacement one-time sign-in link.", kind: "supporting", source: "Login source" },
      { id: "invalid-link", label: "Invalid / Tampered Link", summary: "Reject the token and return to a safe sign-in recovery path.", kind: "supporting", source: "Login source" },
      { id: "mfa-failed", label: "MFA Verification Failed", summary: "Remain outside the authenticated session and allow governed retry/recovery.", kind: "supporting", source: "Login source" },
      { id: "too-many-attempts", label: "Too Many Attempts", summary: "Rate-limit repeated authentication attempts.", kind: "supporting", source: "Login source" },
      { id: "account-deactivated", label: "Account Deactivated / Suspended", summary: "Do not establish an Exchange session for a restricted account.", kind: "supporting", source: "Login source" },
      { id: "network-server-error", label: "Network / Server Error", summary: "Provide retry without manufacturing a successful authentication state.", kind: "supporting", source: "Login source" },
    ],
  },
  {
    id: "error-handling",
    label: "Error Handling",
    summary: "Recovery behavior explicitly called out by the Login source.",
    kind: "supporting",
    source: "Login source",
    children: [
      { id: "clear-messages", label: "Clear Error Messages", summary: "Explain the failure without exposing sensitive account information.", kind: "supporting", source: "Login source" },
      { id: "resend-link", label: "Resend Link", summary: "Allow a new one-time challenge where permitted.", kind: "supporting", source: "Login source" },
      { id: "rate-limiting", label: "Rate Limiting", summary: "Throttle abusive or repeated challenge attempts.", kind: "supporting", source: "Login source" },
      { id: "support-option", label: "Support Option", summary: "Provide a support path for unresolved access problems.", kind: "supporting", source: "Login source" },
      { id: "safe-return", label: "Return to Login Safely", summary: "Recovery always returns through the governed identity entry boundary.", kind: "supporting", source: "Login source" },
    ],
  },
];

const registrationSourceSupport: AuthEntryNode[] = [
  {
    id: "key-outcomes",
    label: "Key Outcomes",
    summary: "The end-state outcomes listed in the Registration source.",
    kind: "supporting",
    source: "Registration source",
    children: [
      { id: "account-created-verified", label: "Account Created & Verified", summary: "Person-level account identity has been created and verified.", kind: "outcome", source: "Registration source" },
      { id: "organization-established", label: "Organization Established", summary: "The participant is resolved to a canonical organization context.", kind: "outcome", source: "Registration source" },
      { id: "geography-set", label: "Geography Set", summary: "Initial locality and market geography are established.", kind: "outcome", source: "Registration source" },
      { id: "map-marker-placed", label: "Map Marker Placed", summary: "A geocoded organization location can be represented in the Exchange map when visibility permits.", kind: "outcome", source: "Registration source" },
      { id: "membership-active", label: "Membership Active", summary: "The selected organization membership path is active when its commercial requirements are satisfied.", kind: "outcome", source: "Registration source" },
      { id: "exchange-access", label: "Exchange Access", summary: "Exchange access is granted only after readiness and entitlement checks pass.", kind: "outcome", source: "Registration source" },
    ],
  },
  {
    id: "business-rules",
    label: "Business Rules",
    summary: "Rules explicitly stated by the Registration source.",
    kind: "supporting",
    source: "Registration source",
    children: [
      { id: "one-account-per-email", label: "One Account per User Email", summary: "Registration must not silently create duplicate user identities for the same email.", kind: "supporting", source: "Registration source" },
      { id: "one-primary-organization", label: "One Primary Organization per Account", summary: "The Registration source defines one primary organization for the account.", kind: "supporting", source: "Registration source" },
      { id: "geography-locked", label: "Geography Locked at Registration", summary: "Initial geography is bound during Registration and can expand later as the source allows.", kind: "supporting", source: "Registration source" },
      { id: "founding-payment-required", label: "Payment Required for Founding Membership", summary: "Founding Membership is not activated until its payment requirement is satisfied.", kind: "supporting", source: "Registration source" },
    ],
  },
];

function completeTree(): AuthEntryNode {
  return {
    ...baseAuthEntryTree,
    children: (baseAuthEntryTree.children ?? []).map((child) => {
      if (child.id === "sign-in") {
        return { ...child, children: [...(child.children ?? []), ...loginSourceSupport] };
      }
      if (child.id === "register") {
        return { ...child, children: [...(child.children ?? []), ...registrationSourceSupport] };
      }
      return child;
    }),
  };
}

export const authEntryTree = completeTree();

export function findAuthEntryNode(path: string[]): AuthEntryResolvedNode | undefined {
  let node = authEntryTree;
  const breadcrumbs: Array<{ label: string; path: string[] }> = [
    { label: authEntryTree.label, path: [] },
  ];
  const resolvedPath: string[] = [];

  for (const segment of path) {
    const next = node.children?.find((child) => child.id === segment);
    if (!next) return undefined;
    resolvedPath.push(segment);
    node = next;
    breadcrumbs.push({ label: node.label, path: [...resolvedPath] });
  }

  return { node, path: [...resolvedPath], breadcrumbs };
}

export function flattenAuthEntryPaths() {
  const paths: string[][] = [];

  function walk(node: AuthEntryNode, path: string[]) {
    for (const child of node.children ?? []) {
      const nextPath = [...path, child.id];
      paths.push(nextPath);
      walk(child, nextPath);
    }
  }

  walk(authEntryTree, []);
  return paths;
}

export { authEntryNodeHref, resolveAuthEntryDestination };
export type { AuthEntryNode, AuthEntryResolvedNode };
