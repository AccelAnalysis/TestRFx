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

export interface MenuUtilityAction {
  id: string;
  label: string;
  description: string;
  icon: string;
  scope: MenuScope;
  availability: MenuAvailability;
  destructive?: boolean;
}

export interface MenuSectionDefinition {
  id: MenuSectionId;
  label: string;
  description: string;
  icon: string;
  scope: MenuScope;
  actions: MenuUtilityAction[];
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

const action = (
  id: string,
  label: string,
  description: string,
  icon: string,
  scope: MenuScope,
  options: Partial<Pick<MenuUtilityAction, "availability" | "destructive">> = {},
): MenuUtilityAction => ({
  id,
  label,
  description,
  icon,
  scope,
  availability: options.availability ?? "integration",
  destructive: options.destructive,
});

export const referenceMenuContext: MenuViewerContext = {
  userName: "Reference Member",
  userEmail: "member@example.com",
  organizationName: "Your Organization",
  organizationRole: "Organization admin",
  organizationInitials: "YO",
  membershipLabel: "Reference membership",
  organizationCount: 1,
};

export const menuSections: MenuSectionDefinition[] = [
  {
    id: "organization",
    label: "Organization Profile",
    description: "Manage the active organization's Exchange identity, team, evidence, locations, and administrative controls.",
    icon: "⌂",
    scope: "organization",
    actions: [
      action("organization-details", "Organization details", "Business identity, description, contact details, industry context, and public profile fields.", "▤", "organization"),
      action("verified-information", "Verified information", "Review organization verification and trust-state information without conflating profile completion with verification.", "✓", "organization"),
      action("organization-capabilities", "Capabilities / AMACS", "Manage the same capability identity used by the Capabilities lens, including taxonomy alignment and evidence handoff.", "◇", "organization"),
      action("organization-locations", "Locations", "Manage primary and additional locations, public precision, and service-geography relationships.", "⌖", "organization"),
      action("team-members", "Team members", "Review invitations, roles, permissions, and access to the active organization.", "♙", "organization"),
      action("documents-evidence", "Documents & evidence", "Manage organization-level supporting material and capability evidence metadata.", "▧", "organization"),
      action("brand-visibility", "Brand & visibility", "Control organization presentation and Exchange-facing visibility preferences.", "◐", "organization"),
      action("leave-organization", "Leave organization", "Leave the active organization only after ownership and responsibility checks pass.", "↗", "organization", { destructive: true }),
      action("transfer-ownership", "Transfer organization ownership", "Select a new owner, review the impact, re-authenticate, and confirm the transfer.", "⇄", "organization", { destructive: true }),
      action("deactivate-organization", "Deactivate organization", "Remove the organization from active participation through a governed administrative workflow.", "⊘", "organization", { destructive: true }),
      action("delete-organization", "Delete organization", "Owner-only destructive flow with dependency checks, impact review, re-authentication, and final confirmation.", "×", "organization", { destructive: true }),
    ],
  },
  {
    id: "profile",
    label: "My Profile",
    description: "Manage person-level information separately from the organization the member represents.",
    icon: "●",
    scope: "user",
    actions: [
      action("personal-information", "Personal information", "Name, contact information, and profile presentation.", "◉", "user"),
      action("profile-role", "Role & permissions", "See the member's role and effective permissions for the active organization.", "◆", "user"),
      action("linked-organizations", "Linked organizations", "View organizations you belong to, switch active organization, and choose a default organization.", "⇄", "user"),
    ],
  },
  {
    id: "security",
    label: "Security & Account",
    description: "Authentication, sessions, devices, and personal-account lifecycle controls.",
    icon: "▣",
    scope: "user",
    actions: [
      action("change-password", "Change password / sign-in method", "Manage the production authentication method connected to RFxchange identity.", "⌁", "user"),
      action("mfa", "Multi-factor authentication", "Configure stronger authentication when the production identity provider is connected.", "✦", "user"),
      action("active-sessions", "Active sessions & devices", "Review authenticated sessions and revoke access where necessary.", "▦", "user"),
      action("sign-out-all", "Sign out of all devices", "Invalidate the member's other active sessions through the identity service.", "↪", "user", { destructive: true }),
      action("delete-personal-account", "Delete personal account", "Impact review, re-authentication, and final confirmation before account deletion.", "×", "user", { destructive: true }),
    ],
  },
  {
    id: "settings",
    label: "Settings",
    description: "Cross-lens application preferences that should not be owned by any individual Exchange lens.",
    icon: "⚙",
    scope: "user",
    actions: [
      action("application-preferences", "Application preferences", "General Exchange behavior and presentation preferences.", "◫", "user"),
      action("notification-preferences", "Notification preferences", "Choose which event classes may generate in-app, email, push, or future channel notifications.", "◌", "user"),
      action("privacy-preferences", "Privacy preferences", "Control person-level privacy preferences independently from organization visibility.", "◍", "user"),
    ],
  },
  {
    id: "referrals",
    label: "Referrals Management",
    description: "Manage referrals created from RFx, Resources, Intelligence, Capabilities, and organization contexts.",
    icon: "↗",
    scope: "cross-lens",
    actions: [
      action("referrals-overview", "Overview", "Summary of referral activity, work in progress, completed referrals, and earnings.", "▥", "cross-lens"),
      action("referrals-lifecycle", "Referrals", "Sent, received, in-progress, completed/won, and closed/lost referral lifecycle.", "⇢", "cross-lens"),
      action("referral-policies", "Referral policies", "Organization referral policy, payout terms, minimums, rules, and eligibility criteria.", "§", "organization"),
      action("referral-payments", "Payments & payouts", "Earnings summary, pending payouts, payout history, and payment-method handoff.", "$", "organization"),
      action("referral-reports", "Reports", "Referral performance, conversion, referrer, and trend analysis.", "▥", "cross-lens"),
      action("create-referral", "Create referral", "Select an organization and recipient, attach cross-lens context, preview terms, add a message, and submit.", "+", "cross-lens"),
    ],
  },
  {
    id: "communications",
    label: "Messages & Notifications",
    description: "One communications entry point for conversations and event-driven Exchange notifications.",
    icon: "✉",
    scope: "cross-lens",
    actions: [
      action("messages", "Messages", "All, unread, archived, and searchable conversations.", "✉", "cross-lens"),
      action("notifications", "Notifications", "All, unread, system, and activity notifications emitted by shared platform events.", "◌", "cross-lens"),
    ],
  },
  {
    id: "saved",
    label: "Saved & Watchlist",
    description: "Review saved and watched relationships across Exchange record types.",
    icon: "☆",
    scope: "cross-lens",
    actions: [
      action("saved-organizations", "Saved organizations", "Organizations saved from discovery surfaces.", "☆", "cross-lens"),
      action("saved-rfx", "Saved RFx", "Saved RFx records and opportunity context.", "☆", "cross-lens"),
      action("saved-resources", "Saved resources", "Saved resource offers, requests, and provider records.", "☆", "cross-lens"),
      action("watched-rfx", "Watched RFx", "RFx records with watch semantics and event notifications.", "◉", "cross-lens"),
      action("watched-organizations", "Watched organizations", "Organization relationships with follow/watch semantics.", "◉", "cross-lens"),
    ],
  },
  {
    id: "billing",
    label: "Billing & Membership",
    description: "Organization-scoped commercial membership, payments, invoices, credits, and membership lifecycle.",
    icon: "$",
    scope: "organization",
    actions: [
      action("current-plan", "Current plan", "View the active organization's RFxchange commercial membership and entitlement state.", "◆", "organization"),
      action("change-plan", "Change plan", "Compare plans, select a plan, review commercial changes, and confirm through billing policy.", "⇄", "organization"),
      action("payment-methods", "Payment methods", "Manage authorized billing methods for the active organization.", "▭", "organization"),
      action("invoices", "Invoices", "Invoice history, payment status, and downloadable invoice artifacts.", "▧", "organization"),
      action("credits", "Credits", "Organization credit ledger, including balance, expiry, and application history.", "◈", "organization"),
      action("membership-lifecycle", "Membership lifecycle", "Review activation, renewal, cancellation, capacity, and entitlement events.", "⌁", "organization"),
    ],
  },
  {
    id: "privacy",
    label: "Privacy & Data",
    description: "Person-level privacy, consent, export, and data-request controls.",
    icon: "◍",
    scope: "user",
    actions: [
      action("data-download", "Data download", "Request an export of supported personal data.", "⇩", "user"),
      action("privacy-controls", "Privacy controls", "Review person-level privacy choices and visibility implications.", "◍", "user"),
      action("consent", "Consent", "Review and manage consent records where RFxchange requires them.", "✓", "user"),
      action("data-requests", "Data requests", "Submit and review supported privacy or data-subject requests.", "▤", "user"),
    ],
  },
  {
    id: "support",
    label: "Help & Support",
    description: "Get help without leaving or resetting the active Exchange context.",
    icon: "?",
    scope: "platform",
    actions: [
      action("help-center", "Help center", "Find RFxchange help content and guided support.", "?", "platform"),
      action("how-to-guides", "How-to guides", "Task-oriented guidance for common Exchange workflows.", "▤", "platform"),
      action("faqs", "FAQs", "Frequently asked questions about participation and platform behavior.", "?", "platform"),
      action("contact-support", "Contact support", "Open the production support channel when connected.", "✉", "platform"),
    ],
  },
  {
    id: "about",
    label: "About RFxchange",
    description: "Platform information and the authenticated handoff to canonical legal destinations.",
    icon: "i",
    scope: "platform",
    actions: [
      action("about-platform", "About the platform", "RFxchange platform information and product context.", "i", "platform"),
      action("terms", "Terms of Service", "Canonical Terms of Service destination from the Public / Acquisition shell.", "§", "platform"),
      action("privacy-policy", "Privacy Policy", "Canonical Privacy Policy destination from the Public / Acquisition shell.", "§", "platform"),
      action("version", "Version information", "Application version and release metadata when the deployment service provides it.", "#", "platform"),
    ],
  },
];

export const menuSectionById = Object.fromEntries(
  menuSections.map((section) => [section.id, section]),
) as Record<MenuSectionId, MenuSectionDefinition>;

export const menuSignOutAction = action(
  "sign-out",
  "Sign out",
  "End the current RFxchange session and return to the Identity shell.",
  "↪",
  "user",
  { destructive: true },
);

export function isMenuActionEnabled(actionDefinition: MenuUtilityAction) {
  return actionDefinition.availability === "operational";
}
