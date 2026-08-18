import type { ExchangeLens, ExchangeRecord } from "./contracts";

export type SharedWorkflowId =
  | "save"
  | "watch"
  | "track"
  | "follow"
  | "share"
  | "refer"
  | "match"
  | "team"
  | "connect";

export type SharedServiceId =
  | "saved"
  | "referrals"
  | "messages"
  | "notifications"
  | "membership"
  | "organization"
  | "account"
  | "privacy";

export type RelationshipKind = "saved" | "watching" | "tracking" | "following";
export type WorkflowSource = "action-rail" | "detail" | "menu" | "card";

export interface SharedWorkflowDefinition {
  id: SharedWorkflowId;
  label: string;
  description: string;
  category: "relationship" | "sharing" | "referral" | "matching" | "collaboration";
  relationshipKind?: RelationshipKind;
  service: SharedServiceId;
  productionAdapter: string;
}

export interface SharedServiceDefinition {
  id: SharedServiceId;
  label: string;
  description: string;
  managementFor: string[];
}

export interface SharedWorkflowLaunch {
  workflow: SharedWorkflowId;
  lens: ExchangeLens;
  record: ExchangeRecord;
  source: WorkflowSource;
}

export interface SharedMatchResult {
  recordId: string;
  recordType: string;
  title: string;
  organization: string;
  score: number;
  reasons: string[];
}

export interface SharedWorkflowResult {
  accepted: boolean;
  durable: boolean;
  workflow: SharedWorkflowId;
  eventId?: string | number;
  relationship?: { kind: RelationshipKind; active: boolean };
  deepLink?: string;
  referral?: { id: string; status: string };
  collaboration?: { id: string; status: string; kind: "teaming" | "connection" };
  matches?: SharedMatchResult[];
  message?: string;
}

export interface ReferralWorkflowOptions {
  organizations: { id: string; name: string }[];
  recipients: { id: string; label: string }[];
  policy?: {
    organizationId: string;
    enabled: boolean;
    payoutTerms?: string;
    minimumFeeCents?: number;
    rules?: string[];
    eligibilityCriteria?: string[];
  };
}

export interface SharedServiceItem {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  href?: string;
  meta?: Record<string, string | number | boolean | null>;
}

export interface SharedServiceView {
  service: SharedServiceId;
  view: string;
  title: string;
  description?: string;
  items: SharedServiceItem[];
  summary?: Record<string, string | number | boolean | null>;
  configured: true;
}

export const sharedWorkflowDefinitions: Record<SharedWorkflowId, SharedWorkflowDefinition> = {
  save: {
    id: "save",
    label: "Save",
    description: "Keep a record in the authenticated cross-lens Saved collection.",
    category: "relationship",
    relationshipKind: "saved",
    service: "saved",
    productionAdapter: "PostgreSQL relationship repository",
  },
  watch: {
    id: "watch",
    label: "Watch",
    description: "Persist RFx watch state so lifecycle changes can generate shared notifications.",
    category: "relationship",
    relationshipKind: "watching",
    service: "saved",
    productionAdapter: "PostgreSQL relationship repository + event rules",
  },
  track: {
    id: "track",
    label: "Track",
    description: "Persist Intelligence tracking state for shared event and notification processing.",
    category: "relationship",
    relationshipKind: "tracking",
    service: "saved",
    productionAdapter: "PostgreSQL relationship repository + Intelligence event rules",
  },
  follow: {
    id: "follow",
    label: "Follow",
    description: "Persist an organization/capability relationship across Exchange lenses.",
    category: "relationship",
    relationshipKind: "following",
    service: "saved",
    productionAdapter: "PostgreSQL record and organization relationship repositories",
  },
  share: {
    id: "share",
    label: "Share",
    description: "Create an auditable, permission-aware Exchange share action and canonical deep link.",
    category: "sharing",
    service: "notifications",
    productionAdapter: "PostgreSQL share-link repository + delivery policy",
  },
  refer: {
    id: "refer",
    label: "Refer",
    description: "Create a cross-lens referral tied to the selected Exchange record.",
    category: "referral",
    service: "referrals",
    productionAdapter: "PostgreSQL referral lifecycle + policy + payout services",
  },
  match: {
    id: "match",
    label: "Match",
    description: "Run server-side cross-domain matching and persist match provenance.",
    category: "matching",
    service: "referrals",
    productionAdapter: "PostgreSQL search/matching service with AMACS-ready provenance",
  },
  team: {
    id: "team",
    label: "Team",
    description: "Create a durable teaming request anchored to the selected RFx.",
    category: "collaboration",
    service: "messages",
    productionAdapter: "PostgreSQL collaboration repository + shared notifications",
  },
  connect: {
    id: "connect",
    label: "Connect",
    description: "Create a durable organization-to-organization connection request anchored to a Resource.",
    category: "collaboration",
    service: "messages",
    productionAdapter: "PostgreSQL collaboration repository + shared notifications",
  },
};

export const sharedServiceDefinitions: Record<SharedServiceId, SharedServiceDefinition> = {
  saved: {
    id: "saved",
    label: "Saved & Watchlist",
    description: "Saved organizations, saved RFx/resources, watched RFx, and watched/followed organizations.",
    managementFor: ["save", "watch", "track", "follow"],
  },
  referrals: {
    id: "referrals",
    label: "Referrals Management",
    description: "Overview, lifecycle, policy, payments/payouts, reports, creation, and referral detail.",
    managementFor: ["refer", "referral lifecycle", "policy", "payouts", "reports"],
  },
  messages: {
    id: "messages",
    label: "Messages",
    description: "All, unread, archived, and searchable cross-lens conversations.",
    managementFor: ["messages", "teaming", "connection"],
  },
  notifications: {
    id: "notifications",
    label: "Notifications",
    description: "All, unread, system, and activity notifications from shared platform events.",
    managementFor: ["workflow events", "record changes", "membership events"],
  },
  membership: {
    id: "membership",
    label: "Billing & Membership",
    description: "Organization plan, payments, invoices, payment history, credits, and membership lifecycle.",
    managementFor: ["membership", "credits", "fees", "payments", "payouts"],
  },
  organization: {
    id: "organization",
    label: "Organization",
    description: "Canonical organization membership, team, permissions, locations, and administration context.",
    managementFor: ["team", "roles", "locations", "organization impact checks"],
  },
  account: {
    id: "account",
    label: "Account",
    description: "Authenticated person context, profile, linked organizations, security, sessions, and preferences.",
    managementFor: ["profile", "linked organizations", "security", "preferences"],
  },
  privacy: {
    id: "privacy",
    label: "Privacy & Data",
    description: "Consent, privacy controls, data-export requests, and supported data requests.",
    managementFor: ["privacy", "consent", "data requests"],
  },
};

const actionAliases: Record<string, SharedWorkflowId> = {
  save: "save",
  watch: "watch",
  track: "track",
  follow: "follow",
  "follow-track": "follow",
  share: "share",
  refer: "refer",
  match: "match",
  "match-rfx": "match",
  team: "team",
  "invite-team": "team",
  connect: "connect",
};

export function workflowForAction(actionId: string): SharedWorkflowId | undefined {
  return actionAliases[actionId];
}

export function relationshipKindForWorkflow(workflow: SharedWorkflowId): RelationshipKind | undefined {
  return sharedWorkflowDefinitions[workflow].relationshipKind;
}

export function recordLens(record: Pick<ExchangeRecord, "type">): ExchangeLens {
  if (record.type === "resource") return "resources";
  if (record.type === "intelligence") return "intelligence";
  if (record.type === "capability") return "capabilities";
  return "rfx";
}
