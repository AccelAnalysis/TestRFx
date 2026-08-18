import type { ExchangeLens, ExchangeRecord } from "./contracts";

export type SharedWorkflowId = "save" | "watch" | "track" | "follow" | "share" | "refer" | "match" | "team" | "connect";
export type SharedServiceId = "saved" | "referrals" | "notifications" | "membership";
export type RelationshipKind = "saved" | "watching" | "tracking" | "following";
export type WorkflowSource = "action-rail" | "detail" | "menu";

export interface ExchangeActorContext {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  permissions: string[];
  membership: "free" | "founding" | "member";
}

export interface SharedWorkflowDefinition {
  id: SharedWorkflowId;
  label: string;
  description: string;
  category: "relationship" | "sharing" | "referral" | "matching" | "collaboration";
  relationshipKind?: RelationshipKind;
  durableInReference: boolean;
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
  actor: ExchangeActorContext;
  source: WorkflowSource;
}

export interface SharedWorkflowEvent {
  id: string;
  eventName: string;
  workflow: SharedWorkflowId;
  lens: ExchangeLens;
  recordId: string;
  recordTitle: string;
  actorOrganizationId: string;
  actorOrganizationName: string;
  source: WorkflowSource;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface ReferenceMatch {
  record: ExchangeRecord;
  score: number;
  reasons: string[];
}

export const referenceActorContext: ExchangeActorContext = {
  userId: "reference-user",
  organizationId: "reference-organization",
  organizationName: "Your Organization",
  role: "owner",
  permissions: ["exchange:view", "relationships:write", "referrals:create", "collaboration:create"],
  membership: "founding",
};

export const sharedWorkflowDefinitions: Record<SharedWorkflowId, SharedWorkflowDefinition> = {
  save: { id: "save", label: "Save", description: "Keep a record in the cross-lens Saved collection.", category: "relationship", relationshipKind: "saved", durableInReference: false, productionAdapter: "Authenticated relationship repository" },
  watch: { id: "watch", label: "Watch", description: "Track RFx lifecycle and deadline changes.", category: "relationship", relationshipKind: "watching", durableInReference: false, productionAdapter: "Relationship repository + event rules" },
  track: { id: "track", label: "Track", description: "Track changes to an intelligence signal or insight.", category: "relationship", relationshipKind: "tracking", durableInReference: false, productionAdapter: "Relationship repository + intelligence event rules" },
  follow: { id: "follow", label: "Follow", description: "Follow an organization or capability relationship.", category: "relationship", relationshipKind: "following", durableInReference: false, productionAdapter: "Organization relationship repository" },
  share: { id: "share", label: "Share", description: "Create a permission-aware deep link without leaving the Exchange.", category: "sharing", durableInReference: false, productionAdapter: "Share-link policy and delivery service" },
  refer: { id: "refer", label: "Refer", description: "Start the same referral workflow from any eligible Exchange record.", category: "referral", durableInReference: false, productionAdapter: "Referral engine + commercial settlement" },
  match: { id: "match", label: "Match", description: "Request cross-domain matching using capability, geography, and relationship signals.", category: "matching", durableInReference: false, productionAdapter: "Matching service + AMACS projection" },
  team: { id: "team", label: "Team", description: "Start a collaboration or teaming request anchored to the selected record.", category: "collaboration", durableInReference: false, productionAdapter: "Collaboration/team repository + messaging" },
  connect: { id: "connect", label: "Connect", description: "Start an organization-to-organization connection anchored to a resource.", category: "collaboration", durableInReference: false, productionAdapter: "Relationship/collaboration repository + messaging" },
};

export const sharedServiceDefinitions: Record<SharedServiceId, SharedServiceDefinition> = {
  saved: { id: "saved", label: "Saved & Watchlist", description: "Manage saved, watched, tracked, and followed Exchange relationships.", managementFor: ["save", "watch", "track", "follow"] },
  referrals: { id: "referrals", label: "Referrals", description: "Manage cross-lens referrals after they are created from governed actions.", managementFor: ["refer"] },
  notifications: { id: "notifications", label: "Notifications", description: "One notification center for events emitted by every lens and shared workflow.", managementFor: ["workflow events", "record changes", "membership events"] },
  membership: { id: "membership", label: "Billing & Membership", description: "Resolve organization-level membership and entitlements without making billing a lens.", managementFor: ["membership", "credits", "fees", "payments", "payouts"] },
};

const sharedWorkflowIds = new Set<SharedWorkflowId>(Object.keys(sharedWorkflowDefinitions) as SharedWorkflowId[]);

export function workflowForAction(actionId: string): SharedWorkflowId | undefined {
  return sharedWorkflowIds.has(actionId as SharedWorkflowId) ? actionId as SharedWorkflowId : undefined;
}

export function relationshipKindForWorkflow(workflow: SharedWorkflowId): RelationshipKind | undefined {
  return sharedWorkflowDefinitions[workflow].relationshipKind;
}

export function buildReferenceWorkflowEvent(launch: SharedWorkflowLaunch, payload: Record<string, unknown> = {}): SharedWorkflowEvent {
  const eventNames: Record<SharedWorkflowId, string> = {
    save: "RecordSaved",
    watch: "RFxWatched",
    track: "IntelligenceTracked",
    follow: "OrganizationFollowed",
    share: "RecordShared",
    refer: "ReferralCreated",
    match: "MatchRequested",
    team: "TeamingRequested",
    connect: "ConnectionRequested",
  };

  return {
    id: `${launch.workflow}-${Date.now()}-${launch.record.id}`,
    eventName: eventNames[launch.workflow],
    workflow: launch.workflow,
    lens: launch.lens,
    recordId: launch.record.id,
    recordTitle: launch.record.title,
    actorOrganizationId: launch.actor.organizationId,
    actorOrganizationName: launch.actor.organizationName,
    source: launch.source,
    occurredAt: new Date().toISOString(),
    payload,
  };
}

export function getReferenceMatches(record: ExchangeRecord, records: ExchangeRecord[]): ReferenceMatch[] {
  const sourceMetadata = new Set(record.metadata.map((item) => item.trim().toLowerCase()));

  return records
    .filter((candidate) => candidate.id !== record.id && candidate.organization !== record.organization)
    .map((candidate) => {
      const overlap = candidate.metadata.filter((item) => sourceMetadata.has(item.trim().toLowerCase()));
      const reasons: string[] = [];
      let score = overlap.length * 30;
      if (overlap.length) reasons.push(`${overlap.length} shared metadata signal${overlap.length === 1 ? "" : "s"}`);
      if (candidate.geography === record.geography) {
        score += 25;
        reasons.push("same Exchange geography");
      }
      if (candidate.location && record.location) {
        score += 10;
        reasons.push("both map-addressable");
      }
      if (candidate.type !== record.type) {
        score += 5;
        reasons.push("cross-domain relationship");
      }
      return { record: candidate, score, reasons };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.record.title.localeCompare(right.record.title))
    .slice(0, 3);
}
