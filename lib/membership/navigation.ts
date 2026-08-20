import type { MembershipNavigationNode } from "@/lib/membership/contracts";

/**
 * Source-derived membership navigation.
 * Registration nodes and their children come directly from Registration Steps 9–11.
 * Billing nodes and grandchildren come directly from Menu > Billing & Membership.
 */
export const registrationMembershipTree: MembershipNavigationNode = {
  id: "registration-membership",
  label: "Registration membership path",
  description: "Membership selection, Stripe payment, and registration completion.",
  children: [
    {
      id: "membership-selection",
      label: "9. Membership Selection",
      description: "Choose the membership plan after organization location / map placement.",
      href: "/onboarding/membership",
      children: [
        {
          id: "founding-membership",
          label: "Founding Membership ($49/mo)",
          description: "The currently configured paid organization membership.",
        },
        {
          id: "future-plans",
          label: "Future plans as available",
          description: "Shown only when a real additional plan exists in the membership catalog.",
        },
      ],
    },
    {
      id: "payment",
      label: "10. Payment (Stripe)",
      description: "Complete the paid membership checkout through Stripe.",
      href: "/onboarding/membership/payment",
      children: [
        { id: "payment-details", label: "Enter payment details", description: "Collected by Stripe Checkout." },
        { id: "secure-checkout", label: "Secure checkout", description: "Hosted by Stripe; RFxchange never handles raw card details." },
        { id: "payment-confirmation", label: "Payment confirmation", description: "RFxchange reconciles verified Stripe events before activation." },
      ],
    },
    {
      id: "registration-complete",
      label: "11. Registration Complete",
      description: "Confirm the source-defined outcomes after payment and readiness are resolved.",
      href: "/onboarding/membership/complete",
      children: [
        { id: "account-activated", label: "Account activated", description: "Identity activation remains owned by the Identity shell." },
        { id: "organization-profile-created", label: "Organization profile created", description: "The same organization profile used by the Exchange." },
        { id: "exchange-access", label: "Dashboard / Exchange access", description: "Continue through Exchange-ready completion before entering the persistent Exchange." },
        { id: "welcome-onboarding", label: "Welcome / Onboarding tips", description: "Completion guidance after the registration path." },
      ],
    },
  ],
};

export const billingMembershipTree: MembershipNavigationNode = {
  id: "billing-membership",
  label: "Billing & Membership",
  description: "Authenticated organization billing and membership management from Menu.",
  children: [
    {
      id: "current-plan",
      label: "Current Plan",
      description: "Read the active organization's commercial membership.",
      destination: "/api/membership/account/current",
    },
    {
      id: "change-plan",
      label: "Change Plan",
      description: "Source-defined plan-change workflow. It becomes actionable only for real alternate plans returned by the catalog.",
      children: [
        { id: "compare-plans", label: "Compare Plans", description: "Compare the live public catalog.", destination: "/api/membership/catalog" },
        { id: "select-plan", label: "Select Plan", description: "Select an actually available alternate plan.", destination: "/api/membership/change-plan/select" },
        { id: "review-changes", label: "Review Changes", description: "Review the server-calculated change before confirmation.", destination: "/api/membership/change-plan/review" },
        { id: "confirm-plan", label: "Confirm", description: "Confirm the reviewed plan change server-side.", destination: "/api/membership/change-plan/confirm" },
      ],
    },
    {
      id: "payment-methods",
      label: "Payment Methods",
      description: "Open the authenticated Stripe Customer Portal for payment-method management.",
      destination: "/api/membership/portal",
    },
    {
      id: "credits",
      label: "Credits",
      description: "Read the organization's auditable credit ledger and balance.",
      destination: "/api/membership/account/credits",
    },
    {
      id: "invoices",
      label: "Invoices",
      description: "Organization invoice history and payment state.",
      destination: "/api/membership/account/invoices",
      children: [
        { id: "invoice-history", label: "Invoice History", description: "Read reconciled Stripe invoice history.", destination: "/api/membership/account/invoices" },
        { id: "download-pdf", label: "Download PDF", description: "Resolve a verified organization invoice to its Stripe-hosted PDF.", destination: "/api/membership/invoices/{invoiceId}/pdf" },
        { id: "payment-status", label: "Payment Status", description: "Use the reconciled invoice status returned with invoice history.", destination: "/api/membership/account/invoices" },
      ],
    },
    {
      id: "payment-history",
      label: "Payment History",
      description: "Read organization payment history reconciled from Stripe.",
      destination: "/api/membership/account/payments",
    },
    {
      id: "membership-lifecycle",
      label: "Membership Lifecycle",
      description: "Read the organization's membership status history and Stripe reconciliation events.",
      destination: "/api/membership/account/lifecycle",
    },
  ],
};

export const foundingPublicSections: MembershipNavigationNode[] = [
  { id: "membership-offer", label: "Membership offer", description: "Current Founding Membership offer.", href: "/founding#membership-offer" },
  { id: "availability", label: "Availability", description: "Organization ownership and founding capacity.", href: "/founding#availability" },
  { id: "credits", label: "Credits", description: "Credit value, ownership, and expiration.", href: "/founding#credits" },
  { id: "how-membership-works", label: "How membership works", description: "Public-to-Identity-to-organization-to-payment path.", href: "/founding#how-membership-works" },
  { id: "faq", label: "FAQ", description: "Membership rules already established by the source and project decisions.", href: "/founding#faq" },
];

export function findMembershipNode(root: MembershipNavigationNode, id: string): MembershipNavigationNode | null {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const match = findMembershipNode(child, id);
    if (match) return match;
  }
  return null;
}
