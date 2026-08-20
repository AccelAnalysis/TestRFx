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

const successfulLogin: AuthEntryNode = {
  id: "successful-login",
  label: "Successful Login",
  summary: "Identity is authenticated and ready for the RFxchange readiness decision.",
  kind: "outcome",
  source: "Login source",
  destination: {
    path: "/onboarding/completion",
    label: "Resolve Exchange Readiness",
    owner: "Identity & Onboarding → Exchange-ready Completion",
    service: "/api/onboarding/readiness",
    maturity: "connected-workflow",
  },
  children: [
    {
      id: "enter-rfxchange",
      label: "Enter RFxchange",
      summary: "Enter the requested Exchange destination only after server-side readiness permits it.",
      kind: "outcome",
      source: "Login source",
      destination: {
        path: "/onboarding/completion",
        label: "Continue Through Readiness",
        owner: "Identity & Onboarding → Exchange-ready Completion",
        service: "/api/onboarding/readiness",
        maturity: "connected-workflow",
      },
    },
  ],
};

const loginEmailChildren: AuthEntryNode[] = [
  {
    id: "continue",
    label: "Continue",
    summary: "Submit the participant email to the Login challenge boundary.",
    kind: "handoff",
    source: "Login source",
    destination: {
      path: "/login",
      label: "Enter Email and Continue",
      owner: "Identity & Onboarding → Login",
      service: "/api/auth/login",
      maturity: "connected-api-boundary",
    },
    children: [
      {
        id: "email-found-system",
        label: "Email Found in System?",
        summary: "The configured Identity provider decides whether the account exists and may begin a sign-in challenge.",
        kind: "decision",
        source: "Login source",
        children: [
          {
            id: "email-not-found",
            label: "Email Not Found",
            summary: "No RFxchange identity exists for the submitted email.",
            kind: "decision",
            source: "Login source",
            children: [
              {
                id: "choose-to-register",
                label: "Choose to Register?",
                summary: "The source gives the participant the choice to register or return to Marketing.",
                kind: "decision",
                source: "Login source",
                children: [
                  {
                    id: "register",
                    label: "Go to Register Flow",
                    summary: "Move to Registration with login-recovery context.",
                    kind: "handoff",
                    source: "Login source",
                    destination: {
                      path: "/register",
                      label: "Create Account",
                      owner: "Identity & Onboarding → Registration",
                      service: "/api/identity/register",
                      maturity: "connected-api-boundary",
                      params: { entryKind: "login_recovery" },
                    },
                  },
                  {
                    id: "return-marketing",
                    label: "Return to Marketing Site",
                    summary: "Exit identity and return to the Public / Acquisition shell.",
                    kind: "handoff",
                    source: "Login source",
                    destination: {
                      path: "/",
                      label: "Return to RFxchange",
                      owner: "Public / Acquisition → Marketing",
                      maturity: "connected-workflow",
                    },
                  },
                ],
              },
            ],
          },
          {
            id: "email-found",
            label: "Email Found",
            summary: "Continue with the one-time sign-in challenge.",
            kind: "branch",
            source: "Login source",
            children: [
              {
                id: "send-sign-in-link",
                label: "Send Sign-In Link",
                summary: "Request delivery from the configured Identity provider.",
                kind: "handoff",
                source: "Login source",
                destination: {
                  path: "/login",
                  label: "Request Sign-In Link",
                  owner: "Identity & Onboarding → Login",
                  service: "/api/auth/login",
                  maturity: "connected-api-boundary",
                },
                children: [
                  {
                    id: "check-email",
                    label: "Check Email",
                    summary: "Open the one-time sign-in email delivered by the Identity service.",
                    kind: "instruction",
                    source: "Login source",
                    children: [
                      {
                        id: "click-magic-link",
                        label: "Click Magic Link",
                        summary: "Open the one-time link before its source-defined 15-minute expiration.",
                        kind: "decision",
                        source: "Login source",
                        children: [
                          {
                            id: "link-expired",
                            label: "Link Expired",
                            summary: "The expired challenge cannot create a session.",
                            kind: "branch",
                            source: "Login source",
                            children: [
                              {
                                id: "resend-link",
                                label: "Resend Link",
                                summary: "Request a replacement one-time sign-in challenge.",
                                kind: "handoff",
                                source: "Login source",
                                destination: {
                                  path: "/login",
                                  label: "Request New Link",
                                  owner: "Identity & Onboarding → Login",
                                  service: "/api/auth/login",
                                  maturity: "connected-api-boundary",
                                  params: { reason: "expired" },
                                },
                                children: [
                                  {
                                    id: "return-login",
                                    label: "Return to Login",
                                    summary: "Return to the governed Login screen to request the replacement link.",
                                    kind: "handoff",
                                    source: "Login source",
                                    destination: {
                                      path: "/login",
                                      label: "Return to Login",
                                      owner: "Identity & Onboarding → Login",
                                      maturity: "connected-workflow",
                                    },
                                  },
                                ],
                              },
                            ],
                          },
                          {
                            id: "link-valid",
                            label: "Link Valid",
                            summary: "Proceed to server-side authentication with the configured Identity provider.",
                            kind: "branch",
                            source: "Login source",
                            children: [
                              {
                                id: "authenticate",
                                label: "Authenticate",
                                summary: "Verify the one-time token and resolve whether another factor is required.",
                                kind: "handoff",
                                source: "Login source",
                                destination: {
                                  path: "/login/verify",
                                  label: "Verify Sign-In Link",
                                  owner: "Identity & Onboarding → Login",
                                  service: "/api/auth/login/verify",
                                  maturity: "connected-api-boundary",
                                },
                                children: [
                                  {
                                    id: "additional-verification-required",
                                    label: "Additional Verification Required?",
                                    summary: "The Identity provider decides whether MFA / 2FA is required.",
                                    kind: "decision",
                                    source: "Login source",
                                    children: [
                                      {
                                        id: "mfa-2fa",
                                        label: "MFA / 2FA",
                                        summary: "Complete the additional factor required by Identity policy.",
                                        kind: "branch",
                                        source: "Login source",
                                        destination: {
                                          path: "/login/verify",
                                          label: "Complete Additional Verification",
                                          owner: "Identity & Onboarding → Login / MFA",
                                          service: "/api/auth/login/verify",
                                          maturity: "connected-api-boundary",
                                        },
                                        children: [
                                          {
                                            id: "verify-code",
                                            label: "Verify Code",
                                            summary: "Submit the provider challenge code for validation.",
                                            kind: "handoff",
                                            source: "Login source",
                                            destination: {
                                              path: "/login/verify",
                                              label: "Verify Code",
                                              owner: "Identity & Onboarding → Login / MFA",
                                              service: "/api/auth/login/verify",
                                              maturity: "connected-api-boundary",
                                            },
                                            children: [successfulLogin],
                                          },
                                        ],
                                      },
                                      successfulLogin,
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
            ],
          },
        ],
      },
    ],
  },
];

const invitationChildren: AuthEntryNode[] = [
  {
    id: "validate-invitation",
    label: "Validate Invitation",
    summary: "Validate the source invitation before organization affiliation is granted.",
    kind: "decision",
    source: "Registration source",
    sourceDetail: "No dedicated invitation-validation service exists on main. This state is preserved and handed to Organization Selection / Creation rather than simulated.",
    destination: {
      path: "/onboarding/organization",
      label: "Continue to Organization Resolution",
      owner: "Identity & Onboarding → Organization Selection / Creation",
      service: "/api/onboarding/organizations",
      maturity: "production-pending",
      params: { mode: "invitation" },
    },
    children: [
      {
        id: "accept-join-organization",
        label: "Accept / Join Organization",
        summary: "Join the organization referenced by a valid invitation.",
        kind: "handoff",
        source: "Registration source",
        destination: {
          path: "/onboarding/organization",
          label: "Resolve Organization Access",
          owner: "Identity & Onboarding → Organization Selection / Creation",
          service: "/api/onboarding/organizations",
          maturity: "production-pending",
          params: { mode: "invitation" },
        },
        children: [
          {
            id: "set-role-confirm-access",
            label: "Set Role / Confirm Access",
            summary: "Confirm the participant role and organization access after invitation acceptance.",
            kind: "handoff",
            source: "Registration source",
            destination: {
              path: "/onboarding/organization",
              label: "Confirm Organization Access",
              owner: "Identity & Onboarding → Organization Selection / Creation",
              service: "/api/onboarding/organizations",
              maturity: "production-pending",
              params: { mode: "invitation" },
            },
          },
        ],
      },
    ],
  },
];

const registrationCreateAccountChildren: AuthEntryNode[] = [
  { id: "name", label: "Name", summary: "Capture the participant name defined by the Registration source.", kind: "supporting", source: "Registration source" },
  { id: "email", label: "Email", summary: "Capture the participant account email defined by the Registration source.", kind: "supporting", source: "Registration source" },
  {
    id: "create-password",
    label: "Create Password",
    summary: "The Registration source explicitly includes password creation.",
    kind: "supporting",
    source: "Registration source",
    sourceDetail: "The current merged RFxchange Login architecture is passwordless. The public entry tree preserves this source item without inventing a second credential store; authentication-method execution remains owned by the configured Identity provider.",
  },
];

const registrationVerificationChildren: AuthEntryNode[] = [
  {
    id: "verification-email-sent",
    label: "Verification Email Sent",
    summary: "The configured Account Verification provider accepts and delivers the verification challenge.",
    kind: "instruction",
    source: "Registration source",
    destination: {
      path: "/onboarding/account-verification",
      label: "Request Verification",
      owner: "Identity & Onboarding → Account Verification",
      service: "/api/identity/account-verification",
      maturity: "connected-api-boundary",
    },
    children: [
      {
        id: "click-verification-link",
        label: "Click Verification Link",
        summary: "Open the verification link delivered by the configured provider.",
        kind: "decision",
        source: "Registration source",
        children: [
          {
            id: "email-verified",
            label: "Email Verified?",
            summary: "The verification provider returns a verified, expired, or invalid result.",
            kind: "decision",
            source: "Registration source",
            children: [
              {
                id: "verified",
                label: "Verified",
                summary: "Continue into the next onboarding requirement after email control is proven.",
                kind: "outcome",
                source: "Registration source",
                destination: {
                  path: "/onboarding/organization",
                  label: "Continue to Organization Setup",
                  owner: "Identity & Onboarding → Organization Selection / Creation",
                  service: "/api/onboarding/organizations",
                  maturity: "connected-workflow",
                },
              },
              {
                id: "not-verified",
                label: "Not Verified",
                summary: "Use the source-defined resend/change-email recovery path.",
                kind: "branch",
                source: "Registration source",
                children: [
                  {
                    id: "resend-verification",
                    label: "Resend Verification",
                    summary: "Request a replacement verification challenge.",
                    kind: "branch",
                    source: "Registration source",
                    destination: {
                      path: "/onboarding/account-verification",
                      label: "Resend Verification",
                      owner: "Identity & Onboarding → Account Verification",
                      service: "/api/identity/account-verification",
                      maturity: "connected-api-boundary",
                    },
                    children: [
                      {
                        id: "resend-email",
                        label: "Resend Email",
                        summary: "Send another verification challenge to the current account email.",
                        kind: "handoff",
                        source: "Registration source",
                        destination: {
                          path: "/onboarding/account-verification",
                          label: "Resend Email",
                          owner: "Identity & Onboarding → Account Verification",
                          service: "/api/identity/account-verification",
                          maturity: "connected-api-boundary",
                        },
                      },
                      {
                        id: "change-email",
                        label: "Change Email",
                        summary: "Correct the pending account email and issue a new verification challenge.",
                        kind: "handoff",
                        source: "Registration source",
                        destination: {
                          path: "/onboarding/account-verification",
                          label: "Change Email",
                          owner: "Identity & Onboarding → Account Verification",
                          service: "/api/identity/account-verification",
                          maturity: "connected-api-boundary",
                        },
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
];

const geographyChildren: AuthEntryNode[] = [
  {
    id: "search-county-city-region",
    label: "Search County / City / Region",
    summary: "Search the geography vocabulary defined by the Registration source.",
    kind: "handoff",
    source: "Registration source",
    destination: {
      path: "/onboarding/geography",
      label: "Search Geography",
      owner: "Identity & Onboarding → Geography",
      service: "/api/onboarding/geography",
      maturity: "connected-workflow",
    },
    children: [
      {
        id: "initial-locality",
        label: "System Sets Initial Locality",
        summary: "Persist the selected initial locality as onboarding geography context.",
        kind: "outcome",
        source: "Registration source",
        destination: {
          path: "/onboarding/geography",
          label: "Set Initial Locality",
          owner: "Identity & Onboarding → Geography",
          service: "/api/onboarding/geography",
          maturity: "connected-workflow",
        },
        children: [
          {
            id: "market-boundaries",
            label: "Market Boundaries",
            summary: "Establish the source-defined market boundary context for the initial geography.",
            kind: "outcome",
            source: "Registration source",
            destination: {
              path: "/onboarding/geography",
              label: "Review Market Boundaries",
              owner: "Identity & Onboarding → Geography",
              service: "/api/onboarding/geography",
              maturity: "connected-workflow",
            },
          },
        ],
      },
    ],
  },
];

const organizationDetailChildren: AuthEntryNode[] = [
  { id: "name", label: "Name", summary: "Organization name.", kind: "supporting", source: "Registration source" },
  { id: "description", label: "Description", summary: "Organization description.", kind: "supporting", source: "Registration source" },
  { id: "industry-naics", label: "Industry / NAICS (Optional)", summary: "Optional industry / NAICS information from the Registration source.", kind: "supporting", source: "Registration source" },
  { id: "website-contact", label: "Website / Contact", summary: "Organization website and contact information.", kind: "supporting", source: "Registration source" },
];

const locationChildren: AuthEntryNode[] = [
  {
    id: "physical-address",
    label: "Physical Address",
    summary: "Capture the physical organization location.",
    kind: "handoff",
    source: "Registration source",
    destination: {
      path: "/onboarding/geography",
      label: "Enter Physical Address",
      owner: "Identity & Onboarding → Geography",
      service: "/api/onboarding/geography",
      maturity: "connected-workflow",
    },
    children: [
      {
        id: "system-geocodes",
        label: "System Geocodes",
        summary: "Resolve the physical address to map coordinates through the Geography workflow.",
        kind: "outcome",
        source: "Registration source",
        destination: {
          path: "/onboarding/geography",
          label: "Geocode Location",
          owner: "Identity & Onboarding → Geography",
          service: "/api/onboarding/geography",
          maturity: "connected-workflow",
        },
        children: [
          {
            id: "marker-placed-map",
            label: "Marker Placed on Map",
            summary: "The geocoded organization can appear as the source-defined map marker when visibility/readiness permits.",
            kind: "outcome",
            source: "Registration source",
            destination: {
              path: "/onboarding/geography",
              label: "Review Map Placement",
              owner: "Identity & Onboarding → Geography",
              service: "/api/onboarding/geography",
              maturity: "connected-workflow",
            },
          },
        ],
      },
    ],
  },
];

const paymentChildren: AuthEntryNode[] = [
  {
    id: "enter-payment-details",
    label: "Enter Payment Details",
    summary: "Payment details are entered on Stripe-hosted Checkout; RFxchange never collects raw payment credentials.",
    kind: "handoff",
    source: "Registration source",
    destination: {
      path: "/onboarding/membership",
      label: "Start Stripe Checkout",
      owner: "Identity & Onboarding → Membership / Stripe Checkout",
      service: "/api/membership/checkout",
      maturity: "connected-api-boundary",
      params: { membership: "founding" },
    },
    children: [
      {
        id: "secure-checkout",
        label: "Secure Checkout",
        summary: "Stripe-hosted subscription checkout handles the payment UI and authentication.",
        kind: "handoff",
        source: "Registration source",
        destination: {
          path: "/onboarding/membership",
          label: "Continue to Secure Checkout",
          owner: "Identity & Onboarding → Membership / Stripe Checkout",
          service: "/api/membership/checkout",
          maturity: "connected-api-boundary",
          params: { membership: "founding" },
        },
        children: [
          {
            id: "payment-confirmation",
            label: "Payment Confirmation",
            summary: "RFxchange confirms the Checkout Session server-side; signed Stripe webhook events finalize membership entitlement.",
            kind: "outcome",
            source: "Registration source",
            destination: {
              path: "/onboarding/membership/complete",
              label: "Confirm Stripe Checkout",
              owner: "Identity & Onboarding → Membership / Stripe Confirmation",
              service: "/api/membership/checkout/verify",
              maturity: "connected-api-boundary",
            },
          },
        ],
      },
    ],
  },
];

const registrationCompleteChildren: AuthEntryNode[] = [
  {
    id: "account-activated",
    label: "Account Activated",
    summary: "Account state is eligible to proceed after the required identity conditions are satisfied.",
    kind: "outcome",
    source: "Registration source",
    destination: {
      path: "/onboarding/completion",
      label: "Review Account Readiness",
      owner: "Identity & Onboarding → Exchange-ready Completion",
      service: "/api/onboarding/readiness",
      maturity: "connected-workflow",
    },
  },
  {
    id: "organization-profile-created",
    label: "Organization Profile Created",
    summary: "The canonical organization profile exists through the Organization Profile workflow.",
    kind: "outcome",
    source: "Registration source",
    destination: {
      path: "/onboarding/organization-profile",
      label: "Review Organization Profile",
      owner: "Identity & Onboarding → Organization Profile",
      service: "/api/onboarding/organization-profile",
      maturity: "connected-api-boundary",
    },
  },
  {
    id: "dashboard-exchange-access",
    label: "Dashboard / Exchange Access",
    summary: "Exchange access follows only when readiness and entitlement checks permit it.",
    kind: "outcome",
    source: "Registration source",
    destination: {
      path: "/onboarding/completion",
      label: "Resolve Exchange Access",
      owner: "Identity & Onboarding → Exchange-ready Completion",
      service: "/api/onboarding/readiness",
      maturity: "connected-workflow",
    },
  },
  {
    id: "welcome-onboarding-tips",
    label: "Welcome / Onboarding Tips",
    summary: "The source calls for welcome/onboarding guidance after Registration completes.",
    kind: "supporting",
    source: "Registration source",
    destination: {
      path: "/onboarding/completion",
      label: "Continue from Completion",
      owner: "Identity & Onboarding → Exchange-ready Completion",
      maturity: "connected-workflow",
    },
  },
];

function patchNode(node: AuthEntryNode): AuthEntryNode {
  const patched: AuthEntryNode = {
    ...node,
    children: node.children?.map(patchNode),
  };

  if (patched.id === "enter-email" && patched.source === "Login source") {
    patched.children = loginEmailChildren;
  }

  if (patched.id === "payment" && patched.source === "Registration source") {
    patched.destination = {
      path: "/onboarding/membership",
      label: "Continue to Stripe Payment",
      owner: "Identity & Onboarding → Membership / Stripe Checkout",
      service: "/api/membership/checkout",
      maturity: "connected-api-boundary",
      params: { membership: "founding" },
    };
    patched.summary = "Stripe-hosted subscription checkout for the source-defined Founding Membership payment step.";
    patched.children = paymentChildren;
  }

  if (patched.id === "partner-invitation" && patched.source === "Registration source") {
    patched.children = invitationChildren;
  }

  if (patched.id === "create-account" && patched.source === "Registration source") {
    patched.children = registrationCreateAccountChildren;
  }

  if (patched.id === "verify-email" && patched.source === "Registration source") {
    patched.children = registrationVerificationChildren;
  }

  if (patched.id === "select-geography" && patched.source === "Registration source") {
    patched.children = geographyChildren;
  }

  if (patched.id === "organization-details" && patched.source === "Registration source") {
    patched.children = organizationDetailChildren;
  }

  if (patched.id === "location-map-placement" && patched.source === "Registration source") {
    patched.children = locationChildren;
  }

  if (patched.id === "registration-complete" && patched.source === "Registration source") {
    patched.children = registrationCompleteChildren;
  }

  return patched;
}

function completeTree(): AuthEntryNode {
  const patchedRoot = patchNode(baseAuthEntryTree);
  return {
    ...patchedRoot,
    children: (patchedRoot.children ?? []).map((child) => {
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
