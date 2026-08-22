export type MenuSectionId =
  | "organization"
  | "profile"
  | "security"
  | "settings"
  | "referrals"
  | "communications"
  | "saved"
  | "billing"
  | "privacy"
  | "support"
  | "about";

export type MenuScope = "organization" | "user" | "cross-lens" | "platform";
export type MenuAvailability = "operational" | "integration";
export type MenuNodeKind = "section" | "submenu" | "task" | "workflow" | "confirmation" | "handoff";
export type MenuSurfaceKind = "overview" | "list" | "form" | "detail" | "sequence" | "handoff";

export interface MenuDestination {
  type: "service" | "public-shell" | "exchange" | "identity-shell";
  target: string;
}

export interface MenuNode {
  id: string;
  label: string;
  description: string;
  icon: string;
  scope: MenuScope;
  kind: MenuNodeKind;
  surface: MenuSurfaceKind;
  availability: MenuAvailability;
  destructive?: boolean;
  requiredRole?: string;
  destination?: MenuDestination;
  details?: string[];
  children?: MenuNode[];
}

export interface MenuViewerContext {
  userName: string;
  userEmail: string;
  organizationName: string;
  organizationRole: string;
  organizationInitials: string;
  membershipLabel: string;
  organizationCount: number;
}

type NodeOptions = Partial<Pick<MenuNode,
  "kind" | "surface" | "availability" | "destructive" | "requiredRole" | "destination" | "details" | "children"
>>;

const node = (
  id: string,
  label: string,
  description: string,
  icon: string,
  scope: MenuScope,
  options: NodeOptions = {},
): MenuNode => ({
  id,
  label,
  description,
  icon,
  scope,
  kind: options.kind ?? "task",
  surface: options.surface ?? "detail",
  availability: options.availability ?? "integration",
  destructive: options.destructive,
  requiredRole: options.requiredRole,
  destination: options.destination,
  details: options.details,
  children: options.children,
});

const section = (
  id: MenuSectionId,
  label: string,
  description: string,
  icon: string,
  scope: MenuScope,
  children: MenuNode[],
): MenuNode => node(id, label, description, icon, scope, {
  kind: "section",
  surface: "overview",
  children,
});

const submenu = (
  id: string,
  label: string,
  description: string,
  icon: string,
  scope: MenuScope,
  children: MenuNode[],
  options: NodeOptions = {},
): MenuNode => node(id, label, description, icon, scope, {
  ...options,
  kind: options.kind ?? "submenu",
  surface: options.surface ?? "overview",
  children,
});

const workflow = (
  id: string,
  label: string,
  description: string,
  icon: string,
  scope: MenuScope,
  children: MenuNode[],
  options: NodeOptions = {},
): MenuNode => node(id, label, description, icon, scope, {
  ...options,
  kind: "workflow",
  surface: "sequence",
  children,
});

const service = (target: string): MenuDestination => ({ type: "service", target });

export const referenceMenuContext: MenuViewerContext = {
  userName: "Reference Member",
  userEmail: "member@example.com",
  organizationName: "Your Organization",
  organizationRole: "Organization admin",
  organizationInitials: "YO",
  membershipLabel: "Reference membership",
  organizationCount: 1,
};

export const destructiveImpactChecks = [
  "Active membership or unpaid invoices",
  "Unpaid referral payouts",
  "Active RFx, resources, or team responsibilities",
  "Sole administrator / ownership status",
];

const organizationAdministration = submenu(
  "organization-administration",
  "Organization administration",
  "Governed organization lifecycle, ownership, team-removal, deactivation, and deletion controls.",
  "⚙",
  "organization",
  [
    node("leave-organization", "Leave organization", "Remove yourself from the active organization after authority and responsibility checks pass.", "↗", "organization", {
      kind: "workflow",
      surface: "sequence",
      destructive: true,
      destination: service("organization-membership-service"),
      details: ["Confirm another authorized member can retain required organization responsibilities before leaving."],
    }),
    workflow("transfer-ownership", "Transfer organization ownership", "Move organization ownership through the source-defined three-step transfer flow.", "⇄", "organization", [
      node("transfer-select-owner", "Select new owner", "Choose an eligible organization member to receive ownership.", "1", "organization", { surface: "form", destination: service("organization-membership-service") }),
      node("transfer-review-impact", "Review impact", "Review role, billing, administration, and downstream ownership consequences before transfer.", "2", "organization", { destination: service("authorization-policy-service") }),
      node("transfer-confirm", "Confirm transfer", "Re-authenticate where required and confirm the ownership transfer.", "3", "organization", { kind: "confirmation", destructive: true, destination: service("organization-membership-service") }),
    ], { destructive: true, requiredRole: "Owner" }),
    node("remove-team-member", "Remove team member", "Remove a member from the organization after role, ownership, and active-responsibility checks.", "−", "organization", {
      kind: "workflow",
      destructive: true,
      destination: service("organization-membership-service"),
    }),
    node("deactivate-organization", "Deactivate organization", "Remove the organization from active RFxchange participation through a governed administrative workflow.", "⊘", "organization", {
      kind: "workflow",
      destructive: true,
      requiredRole: "Admin / Owner",
      destination: service("organization-service"),
    }),
    workflow("delete-organization", "Delete organization", "Owner-only multi-step deletion flow from the Menu source.", "×", "organization", [
      node("delete-organization-impact", "Step 1 — Impact review", "Review the permanent consequences and resolve blocking organization dependencies.", "1", "organization", {
        surface: "detail",
        destructive: true,
        details: [
          "This will permanently delete the organization.",
          "All associated data, RFx, resources, referrals, and history will be removed.",
          "This action cannot be undone.",
        ],
        destination: service("organization-dependency-check-service"),
      }),
      node("delete-organization-identity", "Step 2 — Confirm identity", "Re-authenticate before the organization can be deleted.", "2", "organization", {
        surface: "form",
        destructive: true,
        destination: service("identity-session-service"),
      }),
      node("delete-organization-final", "Final confirmation", "Final irreversible confirmation to delete the organization.", "3", "organization", {
        kind: "confirmation",
        destructive: true,
        destination: service("organization-service"),
      }),
    ], { destructive: true, requiredRole: "Admin / Owner" }),
  ],
);

export const menuSections: MenuNode[] = [
  section("organization", "Organization Profile", "View and manage the active organization's canonical RFxchange identity.", "⌂", "organization", [
    node("organization-details", "Organization details", "Review the organization's business identity, contact context, industry information, and public profile fields.", "▤", "organization", { destination: service("organization-profile-service") }),
    node("verified-information", "Verified information", "Review organization verification and trust-state information without conflating profile completion with verification.", "✓", "organization", { destination: service("organization-verification-service") }),
    node("organization-capabilities", "Capabilities / AMACS", "Manage the same capability identity used by the Capabilities lens, including AMACS alignment and evidence handoff.", "capability-stack", "organization", { kind: "handoff", surface: "handoff", destination: { type: "exchange", target: "capabilities" } }),
    node("organization-locations", "Locations", "Manage primary and additional locations, public precision, and service-geography relationships.", "⌖", "organization", { destination: service("organization-geography-service") }),
    submenu("team-members", "Team members", "Manage organization membership, roles, invitations, and access.", "♙", "organization", [
      node("team-list", "Team list", "Review current organization members.", "▦", "organization", { surface: "list", destination: service("organization-membership-service") }),
      node("team-roles-permissions", "Roles & permissions", "Review and manage role and permission assignments.", "◆", "organization", { destination: service("authorization-policy-service") }),
      node("team-invitations", "Invitations", "Review pending invitations and invite eligible members.", "+", "organization", { surface: "list", destination: service("organization-invitation-service") }),
      node("team-access-management", "Access management", "Manage organization access without confusing membership with public organization verification.", "▣", "organization", { destination: service("organization-membership-service") }),
    ]),
    node("documents-evidence", "Documents & evidence", "Manage organization-level supporting material and capability evidence metadata.", "▧", "organization", { destination: service("object-storage-evidence-service") }),
    node("brand-visibility", "Brand & visibility settings", "Control organization presentation and Exchange-facing visibility preferences.", "◐", "organization", { destination: service("organization-profile-service") }),
    submenu("edit-organization", "Edit / manage organization", "Source-defined organization editing surface.", "✎", "organization", [
      node("organization-basic-information", "Basic information", "Edit canonical organization identity fields.", "▤", "organization", { surface: "form", destination: service("organization-profile-service") }),
      node("organization-contact-address", "Contact & address", "Edit organization contact and address information while preserving geography/public-precision rules.", "⌖", "organization", { surface: "form", destination: service("organization-profile-service") }),
      node("organization-industry-codes", "Industry & codes", "Manage industry classification and relevant organization codes.", "#", "organization", { surface: "form", destination: service("organization-profile-service") }),
      node("organization-certifications", "Certifications", "Manage organization certification metadata and supporting evidence.", "✓", "organization", { surface: "form", destination: service("organization-verification-service") }),
      node("organization-description", "Description", "Edit the organization's Exchange-facing description.", "¶", "organization", { surface: "form", destination: service("organization-profile-service") }),
      node("organization-logo-branding", "Logo & branding", "Manage the organization logo and brand presentation assets.", "◐", "organization", { surface: "form", destination: service("object-storage-media-service") }),
    ]),
    organizationAdministration,
  ]),

  section("profile", "My Profile", "Manage person-level information separately from the organization you represent.", "●", "user", [
    submenu("edit-profile", "Edit profile", "Manage the source-defined personal profile fields.", "✎", "user", [
      node("personal-information", "Personal information", "Manage your name and person-level profile information.", "personal-profile", "user", { surface: "form", destination: service("identity-profile-service") }),
      node("contact-details", "Contact details", "Manage person-level contact details separately from organization contact information.", "✉", "user", { surface: "form", destination: service("identity-profile-service") }),
      node("profile-photo", "Profile photo", "Manage the personal profile image and its storage metadata.", "●", "user", { surface: "form", destination: service("object-storage-media-service") }),
    ]),
    node("profile-role", "Role & permissions", "See your role and effective permissions for the active organization.", "◆", "user", { destination: service("authorization-policy-service") }),
    submenu("linked-organizations", "Linked organizations", "Manage the organizations associated with your personal account.", "⇄", "user", [
      node("organizations-you-belong-to", "Organizations you belong to", "Review organization memberships connected to your account.", "▦", "user", { surface: "list", destination: service("organization-membership-service") }),
      node("switch-active-organization", "Switch active organization", "Change active organization context and re-resolve permissions, ownership, billing, and action availability.", "⇄", "user", { surface: "form", destination: service("organization-context-service") }),
      node("set-default-organization", "Set default organization", "Choose which organization should initialize as active for future authenticated sessions.", "★", "user", { surface: "form", destination: service("organization-context-service") }),
    ]),
  ]),

  section("security", "Security & Account", "Manage password/sign-in methods, MFA, devices, sessions, and account lifecycle.", "▣", "user", [
    node("change-password", "Change password", "Change the credential where the connected identity provider uses passwords.", "security-key", "user", { surface: "form", destination: service("identity-session-service") }),
    node("mfa", "Multi-factor authentication (MFA)", "Configure stronger authentication through the production identity provider.", "✦", "user", { surface: "form", destination: service("identity-session-service") }),
    node("authentication-methods", "Authentication methods", "Manage connected sign-in methods without creating a second RFxchange credential model.", "◈", "user", { surface: "list", destination: service("identity-session-service") }),
    node("active-sessions", "Active sessions / devices", "Review authenticated sessions and devices and revoke access where permitted.", "▦", "user", { surface: "list", destination: service("identity-session-service") }),
    node("sign-out-all", "Sign out of all devices", "Invalidate other active sessions through the identity service.", "↪", "user", { kind: "workflow", destructive: true, destination: service("identity-session-service") }),
    submenu("danger-zone", "Danger zone", "Irreversible personal-account controls require impact review, identity confirmation, and final acknowledgement.", "⚠", "user", [
      workflow("delete-personal-account", "Delete personal account", "Source-defined three-step personal account deletion flow.", "×", "user", [
        node("delete-account-impact", "Step 1 — Impact review", "Review personal-account consequences and acknowledge them before continuing.", "1", "user", {
          destructive: true,
          details: [
            "Your personal account and associated personal data will be deleted.",
            "You will be removed from all organizations.",
            "Active referrals, payouts, and access will end or require resolution.",
            "This action cannot be undone.",
          ],
          destination: service("account-dependency-check-service"),
        }),
        node("delete-account-identity", "Step 2 — Confirm identity", "Re-authenticate before deleting the personal account.", "2", "user", { surface: "form", destructive: true, destination: service("identity-session-service") }),
        node("delete-account-final", "Final confirmation", "Final irreversible confirmation to delete the personal RFxchange account.", "3", "user", { kind: "confirmation", destructive: true, destination: service("identity-account-service") }),
      ], { destructive: true }),
    ]),
  ]),

  section("settings", "Settings", "Cross-lens application, notification, privacy, and general preferences.", "⚙", "user", [
    node("application-preferences", "Application preferences", "General Exchange behavior and presentation preferences.", "application-preferences", "user", { surface: "form", destination: service("user-preferences-service") }),
    node("notification-preferences", "Notification preferences", "Choose which event classes may generate in-app, email, push, or future channel notifications.", "◌", "user", { surface: "form", destination: service("notification-preferences-service") }),
    node("privacy-preferences", "Privacy preferences", "Control person-level privacy preferences independently from organization visibility.", "◍", "user", { surface: "form", destination: service("privacy-consent-service") }),
    node("general-preferences", "General preferences", "Manage remaining cross-lens user preferences that do not belong to a specific domain lens.", "⚙", "user", { surface: "form", destination: service("user-preferences-service") }),
  ]),

  section("referrals", "Referrals Management", "Manage referrals created from RFx, Resources, Intelligence, Capabilities, and organization contexts.", "↗", "cross-lens", [
    submenu("referrals-overview", "Overview", "Referral dashboard summary from the source flow.", "▥", "cross-lens", [
      node("referral-summary", "Summary", "Summary of referral activity.", "▥", "cross-lens", { destination: service("referral-service") }),
      node("referral-overview-in-progress", "In progress", "Referral work currently in progress.", "…", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("referral-overview-completed", "Completed", "Completed referral activity.", "✓", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("referral-overview-earnings", "Earnings", "Referral earnings summary.", "$", "organization", { destination: service("referral-payment-service") }),
    ]),
    submenu("referrals-lifecycle", "Referrals", "Manage the referral lifecycle.", "⇢", "cross-lens", [
      node("sent-referrals", "Sent referrals", "Referrals sent by the active organization/member.", "→", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("received-referrals", "Received referrals", "Referrals received by the active organization/member.", "←", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("referrals-in-progress", "In progress", "Referrals currently being worked.", "…", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("referrals-completed-won", "Completed / won", "Completed or won referral outcomes.", "✓", "cross-lens", { surface: "list", destination: service("referral-service") }),
      node("referrals-closed-lost", "Closed / lost", "Closed or lost referral outcomes.", "×", "cross-lens", { surface: "list", destination: service("referral-service") }),
    ]),
    submenu("referral-policies", "Referral policies", "Manage referral policy terms and eligibility.", "§", "organization", [
      node("my-referral-policy", "My referral policy", "View and manage the active organization's referral policy.", "§", "organization", { surface: "form", destination: service("referral-policy-service") }),
      node("referral-payout-terms", "Payout terms", "Manage payout terms associated with referral policy.", "$", "organization", { surface: "form", destination: service("referral-policy-service") }),
      node("referral-minimums-rules", "Minimums & rules", "Manage referral minimums and business rules.", "#", "organization", { surface: "form", destination: service("referral-policy-service") }),
      node("referral-eligibility", "Eligibility criteria", "Manage eligibility criteria for referral participation.", "✓", "organization", { surface: "form", destination: service("referral-policy-service") }),
    ]),
    submenu("referral-payments", "Payments & payouts", "Manage referral earnings and payout state.", "$", "organization", [
      node("referral-earnings-summary", "Earnings summary", "Referral earnings summary for the active organization.", "$", "organization", { destination: service("referral-payment-service") }),
      node("referral-payout-history", "Payout history", "Historical referral payouts.", "▧", "organization", { surface: "list", destination: service("referral-payment-service") }),
      node("referral-pending-payouts", "Pending payouts", "Referral payouts awaiting completion.", "…", "organization", { surface: "list", destination: service("referral-payment-service") }),
      node("referral-payment-methods", "Payment methods", "Payment-method handoff for referral payouts.", "▭", "organization", { surface: "form", destination: service("referral-payment-service") }),
    ]),
    submenu("referral-reports", "Reports", "Referral reporting surfaces from the source flow.", "▥", "cross-lens", [
      node("referral-performance", "Performance", "Referral performance reporting.", "▥", "cross-lens", { destination: service("referral-reporting-service") }),
      node("referral-conversion-rates", "Conversion rates", "Referral conversion reporting.", "%", "cross-lens", { destination: service("referral-reporting-service") }),
      node("referral-top-referrers", "Top referrers", "Top-referrer reporting.", "★", "cross-lens", { destination: service("referral-reporting-service") }),
      node("referral-trend-analysis", "Trend analysis", "Referral trend reporting over time.", "↗", "cross-lens", { destination: service("referral-reporting-service") }),
    ]),
    workflow("create-referral", "Create referral", "Compose a referral from cross-lens context.", "+", "cross-lens", [
      node("create-referral-organization", "Select organization", "Choose the organization involved in the referral.", "1", "cross-lens", { surface: "form", destination: service("referral-service") }),
      node("create-referral-recipient", "Select recipient", "Choose the intended referral recipient.", "2", "cross-lens", { surface: "form", destination: service("referral-service") }),
      submenu("create-referral-context", "Attach context", "Attach the Exchange entity that explains the referral.", "3", "cross-lens", [
        node("referral-context-rfx", "RFx", "Attach RFx context.", "R", "cross-lens", { destination: service("referral-service") }),
        node("referral-context-resource", "Resource", "Attach Resource context.", "S", "cross-lens", { destination: service("referral-service") }),
        node("referral-context-capability", "Capability", "Attach Capability context.", "C", "cross-lens", { destination: service("referral-service") }),
        node("referral-context-intelligence", "Intelligence", "Attach Intelligence context.", "I", "cross-lens", { destination: service("referral-service") }),
      ]),
      node("create-referral-policy-preview", "Referral policy preview", "Preview governing referral terms before submission.", "4", "cross-lens", { destination: service("referral-policy-service") }),
      node("create-referral-notes", "Notes / message", "Add the referral message or notes.", "5", "cross-lens", { surface: "form", destination: service("referral-service") }),
      node("create-referral-submit", "Submit referral", "Submit the referral after eligibility, authorization, and terms checks pass.", "6", "cross-lens", { kind: "confirmation", destination: service("referral-service") }),
    ]),
    submenu("referral-details", "Referral details", "Inspect a specific referral after selection from a referral list or notification.", "▧", "cross-lens", [
      node("referral-information", "Referral information", "Core referral information and referenced Exchange context.", "i", "cross-lens", { destination: service("referral-service") }),
      node("referral-status-timeline", "Status & timeline", "Referral lifecycle status and event timeline.", "timeline", "cross-lens", { destination: service("referral-service") }),
      node("referral-messages-notes", "Messages / notes", "Referral-specific messages and notes.", "✉", "cross-lens", { destination: service("referral-service") }),
      node("referral-payout-information", "Payout information", "Payout terms and status for the selected referral.", "$", "organization", { destination: service("referral-payment-service") }),
    ]),
  ]),

  section("communications", "Messages & Notifications", "One communications entry point for conversations and event-driven Exchange notifications.", "✉", "cross-lens", [
    submenu("messages", "Messages", "Conversation and inbox management.", "✉", "cross-lens", [
      node("all-messages", "All messages", "All available conversations.", "▦", "cross-lens", { surface: "list", destination: service("messaging-service") }),
      node("unread-messages", "Unread", "Unread conversations and messages.", "●", "cross-lens", { surface: "list", destination: service("messaging-service") }),
      node("archived-messages", "Archived", "Archived conversations.", "□", "cross-lens", { surface: "list", destination: service("messaging-service") }),
      node("search-messages", "Search", "Search the message corpus.", "⌕", "cross-lens", { surface: "form", destination: service("messaging-service") }),
    ]),
    submenu("notifications", "Notifications", "Platform-event notification management.", "◌", "cross-lens", [
      node("all-notifications", "All notifications", "All supported in-app notifications.", "▦", "cross-lens", { surface: "list", destination: service("notification-service") }),
      node("unread-notifications", "Unread", "Unread platform notifications.", "●", "cross-lens", { surface: "list", destination: service("notification-service") }),
      node("system-alerts", "System alerts", "System-level account and platform alerts.", "!", "platform", { surface: "list", destination: service("notification-service") }),
      node("activity-updates", "Activity updates", "Event-driven Exchange activity updates.", "↻", "cross-lens", { surface: "list", destination: service("notification-service") }),
      node("mark-all-read", "Mark all read", "Mark all visible notifications as read through the shared notification service.", "✓", "cross-lens", { kind: "workflow", destination: service("notification-service") }),
    ]),
  ]),

  section("saved", "Saved & Watchlist", "Review saved and watched relationships across Exchange record types.", "☆", "cross-lens", [
    node("saved-organizations", "Saved organizations", "Organizations saved from discovery surfaces.", "☆", "cross-lens", { surface: "list", destination: service("relationship-service") }),
    node("saved-rfx", "Saved RFx", "Saved RFx records and opportunity context.", "☆", "cross-lens", { surface: "list", destination: service("relationship-service") }),
    node("saved-resources", "Saved resources", "Saved resource offers, requests, and provider records.", "☆", "cross-lens", { surface: "list", destination: service("relationship-service") }),
    node("watched-rfx", "Watched RFx", "RFx records with watch semantics and event notifications.", "watching", "cross-lens", { surface: "list", destination: service("relationship-service") }),
    node("watched-organizations", "Watched organizations", "Organization relationships with follow/watch semantics.", "watching", "cross-lens", { surface: "list", destination: service("relationship-service") }),
  ]),

  section("billing", "Billing & Membership", "Organization-scoped plan, payments, credits, invoices, and membership lifecycle.", "$", "organization", [
    node("current-plan", "Current plan", "View the active organization's commercial membership and entitlement state.", "◆", "organization", { destination: service("commercial-membership-service") }),
    workflow("change-plan", "Change plan", "Source-defined plan-change workflow.", "⇄", "organization", [
      node("compare-plans", "Compare plans", "Compare currently available membership plans.", "1", "organization", { destination: service("commercial-membership-service") }),
      node("select-plan", "Select plan", "Select the intended membership plan.", "2", "organization", { surface: "form", destination: service("commercial-membership-service") }),
      node("review-plan-changes", "Review changes", "Review billing, entitlement, capacity, and credit implications.", "3", "organization", { destination: service("commercial-membership-service") }),
      node("confirm-plan-change", "Confirm", "Confirm the authorized plan change.", "4", "organization", { kind: "confirmation", destination: service("billing-payment-service") }),
    ]),
    node("payment-methods", "Payment methods", "Manage authorized billing methods for the active organization.", "▭", "organization", { surface: "list", destination: service("billing-payment-service") }),
    submenu("invoices", "Invoices", "Invoice management and artifacts.", "▧", "organization", [
      node("invoice-history", "Invoice history", "Review historical invoices.", "▦", "organization", { surface: "list", destination: service("billing-payment-service") }),
      node("download-invoice-pdf", "Download PDF", "Download the selected invoice artifact when storage/billing integration provides it.", "⇩", "organization", { kind: "handoff", surface: "handoff", destination: service("billing-payment-service") }),
      node("invoice-payment-status", "Payment status", "Review payment state for the selected invoice.", "✓", "organization", { destination: service("billing-payment-service") }),
    ]),
    node("payment-history", "Payment history", "Review organization payment history separately from invoice documents.", "$", "organization", { surface: "list", destination: service("billing-payment-service") }),
    node("credits", "Credits", "Organization credit ledger, including balance, expiry, and application history.", "◈", "organization", { surface: "list", destination: service("organization-credit-service") }),
    node("membership-lifecycle", "Membership lifecycle", "Review activation, renewal, cancellation, capacity, and entitlement events.", "membership-lifecycle", "organization", { surface: "list", destination: service("commercial-membership-service") }),
  ]),

  section("privacy", "Privacy & Data", "Person-level privacy, consent, export, and data-request controls.", "◍", "user", [
    node("data-download", "Data download", "Request an export of supported personal data.", "⇩", "user", { kind: "workflow", destination: service("privacy-data-service") }),
    node("privacy-controls", "Privacy controls", "Review person-level privacy choices and visibility implications.", "◍", "user", { surface: "form", destination: service("privacy-data-service") }),
    node("consent", "Consent", "Review and manage consent records where RFxchange requires them.", "✓", "user", { surface: "list", destination: service("privacy-consent-service") }),
    node("data-requests", "Data requests", "Submit and review supported privacy or data-subject requests.", "▤", "user", { surface: "list", destination: service("privacy-data-service") }),
  ]),

  section("support", "Help & Support", "Help, guides, FAQs, and production support entry points.", "?", "platform", [
    node("help-center", "Help center", "Find RFxchange help content and guided support.", "?", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "help-center" } }),
    node("how-to-guides", "How-to guides", "Task-oriented guidance for common Exchange workflows.", "▤", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "how-to-guides" } }),
    node("faqs", "FAQs", "Frequently asked questions about participation and platform behavior.", "?", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "faqs" } }),
    node("contact-support", "Contact support", "Open the production support channel when connected.", "✉", "platform", { kind: "handoff", surface: "handoff", destination: service("support-service") }),
  ]),

  section("about", "About RFxchange", "Platform information and authenticated handoffs to canonical public/legal destinations.", "i", "platform", [
    node("about-platform", "About the platform", "RFxchange platform information and product context.", "i", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "/about" } }),
    node("terms", "Terms of Service", "Canonical Terms of Service destination from the Public / Acquisition shell.", "§", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "/terms" } }),
    node("privacy-policy", "Privacy Policy", "Canonical Privacy Policy destination from the Public / Acquisition shell.", "§", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "/privacy" } }),
    node("platform-rules", "Platform Rules", "Connected public legal/rules destination already owned by the Public / Acquisition shell architecture.", "§", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "/platform-rules" } }),
    node("accessibility", "Accessibility", "Connected public accessibility destination already owned by the Public / Acquisition shell architecture.", "♿", "platform", { kind: "handoff", surface: "handoff", destination: { type: "public-shell", target: "/accessibility" } }),
    node("version", "Version information", "Application version and release metadata when the deployment service provides it.", "#", "platform", { destination: service("deployment-metadata-service") }),
  ]),
];

export const menuSignOutNode = workflow(
  "sign-out",
  "Sign out",
  "End the current RFxchange session on this device.",
  "↪",
  "user",
  [
    node("sign-out-confirmation", "Confirm sign out", "Invalidate the current authenticated session before returning to the Identity shell.", "✓", "user", {
      kind: "confirmation",
      destructive: true,
      destination: { type: "identity-shell", target: "login" },
    }),
  ],
  { destructive: true },
);

function flatten(nodes: MenuNode[]): MenuNode[] {
  return nodes.flatMap((entry) => [entry, ...(entry.children ? flatten(entry.children) : [])]);
}

export const menuNodeById = Object.fromEntries(
  flatten([...menuSections, menuSignOutNode]).map((entry) => [entry.id, entry]),
) as Record<string, MenuNode>;

export const menuSectionById = Object.fromEntries(
  menuSections.map((entry) => [entry.id, entry]),
) as Record<MenuSectionId, MenuNode>;

export function isMenuNodeOperational(entry: MenuNode) {
  return entry.availability === "operational";
}

export function canNavigateMenuNode(entry: MenuNode) {
  return Boolean(entry.children?.length) || entry.kind === "section" || entry.kind === "submenu" || entry.kind === "workflow" || entry.kind === "confirmation" || entry.kind === "handoff" || entry.kind === "task";
}

export function describeMenuDestination(entry: MenuNode) {
  if (!entry.destination) return "Menu-defined destination";
  if (entry.destination.type === "service") return `Service boundary: ${entry.destination.target}`;
  if (entry.destination.type === "public-shell") return `Public shell: ${entry.destination.target}`;
  if (entry.destination.type === "identity-shell") return `Identity shell: ${entry.destination.target}`;
  return `Exchange handoff: ${entry.destination.target}`;
}
