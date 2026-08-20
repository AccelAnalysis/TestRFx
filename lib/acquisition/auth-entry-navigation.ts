import {
  type AuthEntryContext,
  authContextSearchParams,
} from "./auth-entry";

export type AuthEntryNodeKind =
  | "branch"
  | "decision"
  | "handoff"
  | "instruction"
  | "outcome"
  | "supporting";

export type AuthEntryServiceMaturity =
  | "connected-workflow"
  | "connected-api-boundary"
  | "identity-service-owned"
  | "production-pending";

export type AuthEntryDestination = {
  path: string;
  label: string;
  owner: string;
  service?: string;
  maturity: AuthEntryServiceMaturity;
  params?: Record<string, string>;
};

export type AuthEntryNode = {
  id: string;
  label: string;
  summary: string;
  kind: AuthEntryNodeKind;
  source: "Login source" | "Registration source" | "Login + Registration sources";
  sourceDetail?: string;
  destination?: AuthEntryDestination;
  children?: AuthEntryNode[];
};

const route = (
  path: string,
  label: string,
  owner: string,
  maturity: AuthEntryServiceMaturity,
  service?: string,
  params?: Record<string, string>,
): AuthEntryDestination => ({ path, label, owner, maturity, service, params });

export const authEntryTree: AuthEntryNode = {
  id: "login-register-entry",
  label: "Login / Register Entry",
  summary: "Public acquisition gateway into RFxchange Identity & Onboarding.",
  kind: "branch",
  source: "Login + Registration sources",
  children: [
    {
      id: "sign-in",
      label: "Sign In",
      summary: "Existing-participant entry into the passwordless Login workflow.",
      kind: "branch",
      source: "Login source",
      destination: route("/login", "Open Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login"),
      children: [
        {
          id: "entry-points",
          label: "Entry Points",
          summary: "The five Login entry points shown in the source flow.",
          kind: "branch",
          source: "Login source",
          children: [
            {
              id: "marketing-site",
              label: "Marketing Site",
              summary: "Public RFxchange marketing entry for an existing participant.",
              kind: "handoff",
              source: "Login source",
              destination: route("/login", "Continue to Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login", { source: "marketing" }),
            },
            {
              id: "mobile-app",
              label: "Mobile App Launch",
              summary: "Mobile launch enters the same Login identity boundary.",
              kind: "handoff",
              source: "Login source",
              destination: route("/login", "Continue to Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login", { source: "mobile-app" }),
            },
            {
              id: "magic-link-email",
              label: "Magic Link Email",
              summary: "Email entry returns to the Login boundary for token validation and session establishment.",
              kind: "handoff",
              source: "Login source",
              destination: route("/login", "Continue to Sign In", "Identity & Onboarding → Login", "identity-service-owned", "/api/auth/login", { source: "magic-link" }),
            },
            {
              id: "direct-url",
              label: "Direct URL",
              summary: "A direct RFxchange URL enters Login while retaining a safe internal destination.",
              kind: "handoff",
              source: "Login source",
              destination: route("/login", "Continue to Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login", { source: "direct-url" }),
            },
            {
              id: "notification-link",
              label: "Notification Link",
              summary: "In-app or email notification entry retains the requested Exchange destination through Login.",
              kind: "handoff",
              source: "Login source",
              destination: route("/login", "Continue to Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login", { source: "notification" }),
            },
          ],
        },
        {
          id: "enter-email",
          label: "Enter Email",
          summary: "Submit the participant email to the Login challenge endpoint.",
          kind: "decision",
          source: "Login source",
          destination: route("/login", "Enter Email", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login"),
          children: [
            {
              id: "email-not-found",
              label: "Email Not Found",
              summary: "The source flow offers Registration rather than creating a silent account.",
              kind: "decision",
              source: "Login source",
              children: [
                {
                  id: "register",
                  label: "Go to Register Flow",
                  summary: "Move to Registration with login-recovery context.",
                  kind: "handoff",
                  source: "Login source",
                  destination: route("/register", "Create Account", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register", { entryKind: "login_recovery" }),
                },
                {
                  id: "return-marketing",
                  label: "Return to Marketing Site",
                  summary: "Exit the identity flow and return to the public RFxchange site.",
                  kind: "handoff",
                  source: "Login source",
                  destination: route("/", "Return to RFxchange", "Public / Acquisition → Marketing", "connected-workflow"),
                },
              ],
            },
            {
              id: "email-found",
              label: "Email Found",
              summary: "Continue into the one-time sign-in challenge workflow.",
              kind: "branch",
              source: "Login source",
              children: [
                {
                  id: "send-sign-in-link",
                  label: "Send Sign-In Link",
                  summary: "The Login API accepts the challenge request; delivery is owned by the configured Identity Gateway.",
                  kind: "handoff",
                  source: "Login source",
                  destination: route("/login", "Request Sign-In Link", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login"),
                  children: [
                    {
                      id: "check-email",
                      label: "Check Email",
                      summary: "Participant opens the email delivered by the Identity service.",
                      kind: "instruction",
                      source: "Login source",
                    },
                    {
                      id: "click-magic-link",
                      label: "Click Magic Link",
                      summary: "The one-time link is validated by the Identity service before a session can exist.",
                      kind: "decision",
                      source: "Login source",
                      children: [
                        {
                          id: "link-expired",
                          label: "Link Expired",
                          summary: "Return to Login and request a new one-time sign-in challenge.",
                          kind: "handoff",
                          source: "Login source",
                          destination: route("/login", "Request New Link", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login", { reason: "expired" }),
                        },
                        {
                          id: "link-valid",
                          label: "Link Valid",
                          summary: "Secure token validation and session creation belong to the configured Identity service.",
                          kind: "branch",
                          source: "Login source",
                          children: [
                            {
                              id: "authenticate",
                              label: "Authenticate",
                              summary: "Verify the one-time link and establish participant identity.",
                              kind: "handoff",
                              source: "Login source",
                              destination: route("/login", "Return to Identity Service", "Identity & Onboarding → Login", "identity-service-owned", undefined, { state: "verify-link" }),
                              children: [
                                {
                                  id: "additional-verification",
                                  label: "Additional Verification Required",
                                  summary: "Optional MFA / 2FA is a Login-source requirement but no production MFA provider is configured in TestRFx.",
                                  kind: "handoff",
                                  source: "Login source",
                                  destination: route("/login", "Return to Sign In", "Identity service / MFA policy", "production-pending", undefined, { state: "additional-verification" }),
                                },
                                {
                                  id: "successful-login",
                                  label: "Successful Login",
                                  summary: "After a real session and permissions are resolved, continue through Exchange-readiness routing.",
                                  kind: "outcome",
                                  source: "Login source",
                                  destination: route("/onboarding/completion", "Resolve Exchange Readiness", "Identity & Onboarding → Exchange-ready Completion", "connected-workflow", "/api/onboarding/readiness"),
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: "session-states",
          label: "Session States",
          summary: "Source-defined session states that belong to Identity/session infrastructure, not the public gateway.",
          kind: "supporting",
          source: "Login source",
          children: [
            { id: "active-session", label: "Active Session", summary: "Valid and active session.", kind: "supporting", source: "Login source" },
            { id: "remembered-device", label: "Remembered Device", summary: "Longer session duration under device policy.", kind: "supporting", source: "Login source" },
            { id: "session-timeout", label: "Session Timeout", summary: "Automatic logout after inactivity.", kind: "supporting", source: "Login source" },
            { id: "manual-logout", label: "Manual Logout", summary: "Participant explicitly ends the session.", kind: "supporting", source: "Login source" },
          ],
        },
        {
          id: "security-features",
          label: "Security Features",
          summary: "Source-defined Login security requirements owned downstream by Identity infrastructure.",
          kind: "supporting",
          source: "Login source",
          children: [
            { id: "magic-link-authentication", label: "Magic Link Authentication", summary: "One-time passwordless sign-in challenge.", kind: "supporting", source: "Login source" },
            { id: "optional-mfa", label: "Optional MFA / 2FA", summary: "Additional verification when required by policy.", kind: "supporting", source: "Login source" },
            { id: "secure-token-validation", label: "Secure Token Validation", summary: "Validate one-time tokens before session creation.", kind: "supporting", source: "Login source" },
            { id: "device-location-monitoring", label: "Device & Location Monitoring", summary: "Identity risk signal defined by the source.", kind: "supporting", source: "Login source" },
            { id: "automatic-session-timeout", label: "Automatic Session Timeout", summary: "Expire inactive sessions according to policy.", kind: "supporting", source: "Login source" },
          ],
        },
      ],
    },
    {
      id: "register",
      label: "Register",
      summary: "New-participant account entry and handoff into the merged onboarding workflows.",
      kind: "branch",
      source: "Registration source",
      destination: route("/register", "Open Registration", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register"),
      children: [
        {
          id: "entry-points",
          label: "Marketing / Entry Point",
          summary: "The four alternate Registration entry paths defined by the source.",
          kind: "branch",
          source: "Registration source",
          children: [
            {
              id: "website-landing-page",
              label: "Website / Landing Page",
              summary: "Standard public registration entry.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/register", "Continue to Registration", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register", { entryKind: "marketing" }),
            },
            {
              id: "campaign-referral-link",
              label: "Campaign / Referral Link",
              summary: "Carries sponsor, referral, and campaign context into Registration.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/register", "Continue to Registration", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register", { entryKind: "campaign" }),
            },
            {
              id: "partner-invitation",
              label: "Partner / Invitation",
              summary: "Pre-authorized invitation context is retained for downstream validation and organization affiliation.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/register", "Continue to Registration", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register", { entryKind: "partner_invitation" }),
            },
            {
              id: "qr-event",
              label: "Scan QR Code / Promo",
              summary: "Event or promotional entry uses the same Registration boundary with event context.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/register", "Continue to Registration", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register", { entryKind: "event_qr" }),
            },
          ],
        },
        {
          id: "choose-action",
          label: "Choose Action",
          summary: "Existing users sign in; new users continue with Registration.",
          kind: "decision",
          source: "Registration source",
          children: [
            {
              id: "existing-user",
              label: "Login — Existing User",
              summary: "Move to the Login workflow without losing safe acquisition context.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/login", "Sign In", "Identity & Onboarding → Login", "connected-api-boundary", "/api/auth/login"),
            },
            {
              id: "new-user",
              label: "Register — New User",
              summary: "Create the person-level RFxchange account.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/register", "Create Account", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register"),
            },
          ],
        },
        {
          id: "create-account",
          label: "Create Account",
          summary: "Capture the participant identity fields owned by the merged Registration module.",
          kind: "handoff",
          source: "Registration source",
          sourceDetail: "The source says name, email, and password. The merged chassis uses the current passwordless Identity architecture, so authentication-method execution remains Identity-owned rather than duplicated here.",
          destination: route("/register", "Create Account", "Identity & Onboarding → Registration", "connected-api-boundary", "/api/identity/register"),
        },
        {
          id: "verify-email",
          label: "Verify Email",
          summary: "Prove control of the account email before organization onboarding.",
          kind: "branch",
          source: "Registration source",
          destination: route("/onboarding/account-verification", "Verify Account Email", "Identity & Onboarding → Account Verification", "connected-api-boundary", "/api/identity/account-verification"),
          children: [
            {
              id: "resend-verification",
              label: "Resend Verification",
              summary: "Request another verification link from the Account Verification workflow.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/onboarding/account-verification", "Resend Verification", "Identity & Onboarding → Account Verification", "connected-api-boundary", "/api/identity/account-verification"),
            },
            {
              id: "change-email",
              label: "Change Email Address",
              summary: "Correct the pending account email and request a new verification challenge.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/onboarding/account-verification", "Change Email", "Identity & Onboarding → Account Verification", "connected-api-boundary", "/api/identity/account-verification"),
            },
          ],
        },
        {
          id: "select-geography",
          label: "Select Geography",
          summary: "Search county / city / region, select the initial locality, and establish market boundaries.",
          kind: "handoff",
          source: "Registration source",
          destination: route("/onboarding/geography", "Set Geography", "Identity & Onboarding → Geography", "connected-workflow", "/api/onboarding/geography"),
        },
        {
          id: "organization-setup",
          label: "Organization Setup",
          summary: "Resolve the participant to a canonical organization instead of creating duplicates.",
          kind: "branch",
          source: "Registration source",
          destination: route("/onboarding/organization", "Resolve Organization", "Identity & Onboarding → Organization Selection / Creation", "connected-workflow", "/api/onboarding/organizations"),
          children: [
            {
              id: "claim-existing",
              label: "Claim Existing Organization",
              summary: "Search, review, and claim or request governed access to an existing organization.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/onboarding/organization", "Claim Existing Organization", "Identity & Onboarding → Organization Selection / Creation", "connected-workflow", "/api/onboarding/organizations"),
            },
            {
              id: "create-new",
              label: "Create New Organization",
              summary: "Create a new organization only after duplicate/entity-resolution review.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/onboarding/organization", "Create New Organization", "Identity & Onboarding → Organization Selection / Creation", "connected-workflow", "/api/onboarding/organizations"),
            },
          ],
        },
        {
          id: "organization-details",
          label: "Organization Details",
          summary: "Organization name, description, optional industry / NAICS, website, and contact information are owned by Organization Profile.",
          kind: "handoff",
          source: "Registration source",
          destination: route("/onboarding/organization-profile", "Complete Organization Details", "Identity & Onboarding → Organization Profile", "connected-api-boundary", "/api/onboarding/organization-profile"),
        },
        {
          id: "location-map-placement",
          label: "Location / Map Placement",
          summary: "Physical address, geocoding, and marker placement are owned by the Geography workflow.",
          kind: "handoff",
          source: "Registration source",
          destination: route("/onboarding/geography", "Set Location & Map Placement", "Identity & Onboarding → Geography", "connected-workflow", "/api/onboarding/geography"),
        },
        {
          id: "membership-selection",
          label: "Membership Selection",
          summary: "Choose the organization participation path defined by the Pricing / Membership domain.",
          kind: "branch",
          source: "Registration source",
          destination: route("/onboarding/membership", "Choose Membership", "Public Pricing / Identity Onboarding → Membership", "connected-api-boundary", "/api/membership/catalog"),
          children: [
            {
              id: "founding-membership",
              label: "Founding Membership ($49/mo)",
              summary: "The current source-defined Founding Membership path.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/onboarding/membership", "Select Founding Membership", "Identity & Onboarding → Membership", "connected-api-boundary", "/api/membership/catalog", { membership: "founding" }),
            },
            {
              id: "future-plans",
              label: "Future Plans as Available",
              summary: "The source reserves future plans; the current catalog should remain the authority rather than inventing unavailable plans.",
              kind: "handoff",
              source: "Registration source",
              destination: route("/founding", "View Current Membership Catalog", "Public / Acquisition → Pricing / Membership", "connected-workflow"),
            },
          ],
        },
        {
          id: "payment",
          label: "Payment (Stripe)",
          summary: "Secure checkout is Membership-owned. The public entry layer does not collect payment or fabricate subscription success.",
          kind: "handoff",
          source: "Registration source",
          destination: route("/onboarding/membership", "Continue to Membership", "Identity & Onboarding → Membership / Stripe boundary", "production-pending", "/api/membership/catalog", { membership: "founding" }),
        },
        {
          id: "registration-complete",
          label: "Registration Complete",
          summary: "Account and organization readiness are re-evaluated before Exchange access is enabled.",
          kind: "outcome",
          source: "Registration source",
          destination: route("/onboarding/completion", "Review Exchange Readiness", "Identity & Onboarding → Exchange-ready Completion", "connected-api-boundary", "/api/onboarding/readiness"),
        },
        {
          id: "supporting-processes",
          label: "Supporting Processes",
          summary: "Source-defined platform requirements that support Registration without becoming separate public entry pages.",
          kind: "supporting",
          source: "Registration source",
          children: [
            { id: "email-communications", label: "Email Communications", summary: "Verification, confirmations, and notifications.", kind: "supporting", source: "Registration source" },
            { id: "security-privacy", label: "Security & Privacy", summary: "Protect participant data and preserve privacy by design.", kind: "supporting", source: "Registration source" },
            { id: "duplicate-detection", label: "Duplicate Detection", summary: "Prevent duplicate accounts and organizations.", kind: "supporting", source: "Registration source" },
          ],
        },
      ],
    },
  ],
};

export type AuthEntryResolvedNode = {
  node: AuthEntryNode;
  path: string[];
  breadcrumbs: Array<{ label: string; path: string[] }>;
};

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

export function authEntryNodeHref(path: string[], contextQuery = "") {
  const base = path.length ? `/auth/${path.join("/")}` : "/auth";
  return contextQuery ? `${base}?${contextQuery}` : base;
}

export function resolveAuthEntryDestination(node: AuthEntryNode, context: AuthEntryContext) {
  if (!node.destination) return undefined;
  if (node.destination.path === "/") return "/";

  const params = authContextSearchParams(context);
  for (const [key, value] of Object.entries(node.destination.params ?? {})) {
    params.set(key, value);
  }

  const query = params.toString();
  return query ? `${node.destination.path}?${query}` : node.destination.path;
}
