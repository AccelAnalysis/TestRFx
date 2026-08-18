export const ONBOARDING_CHECKPOINT_IDS = [
  "account_verified",
  "organization_established",
  "organization_affiliation",
  "geography",
  "organization_profile",
  "capability_profile",
  "visibility",
  "entitlement",
  "amacs_alignment",
  "evidence",
  "keywords",
] as const;

export type OnboardingCheckpointId = (typeof ONBOARDING_CHECKPOINT_IDS)[number];
export type OnboardingCheckpointStatus = "complete" | "needs_attention" | "recommended" | "not_applicable";

export interface OnboardingCheckpoint {
  id: OnboardingCheckpointId;
  status: OnboardingCheckpointStatus;
  value?: string;
  updatedAt: string;
}

export interface OnboardingProgressContext {
  organizationId?: string;
  organizationName?: string;
  geography?: string;
  visibility?: string;
  mapPresence?: "marker_ready" | "off_map";
  capabilitySummary?: string[];
  amacsSummary?: string;
  entitlementSummary?: string;
}

export interface OnboardingActivationState {
  status: "exchange_active";
  activatedAt: string;
  destination: string;
}

export interface OnboardingProgressState {
  version: 1;
  checkpoints: Partial<Record<OnboardingCheckpointId, OnboardingCheckpoint>>;
  context: OnboardingProgressContext;
  activation?: OnboardingActivationState;
  updatedAt: string;
}

export interface OnboardingProgressUpdate {
  checkpoints?: Array<{
    id: OnboardingCheckpointId;
    status: OnboardingCheckpointStatus;
    value?: string;
  }>;
  context?: Partial<OnboardingProgressContext>;
  activation?: OnboardingActivationState;
}

const checkpointIds = new Set<string>(ONBOARDING_CHECKPOINT_IDS);
const checkpointStatuses = new Set<OnboardingCheckpointStatus>([
  "complete",
  "needs_attention",
  "recommended",
  "not_applicable",
]);

export function createEmptyOnboardingProgress(now = new Date().toISOString()): OnboardingProgressState {
  return { version: 1, checkpoints: {}, context: {}, updatedAt: now };
}

export function isOnboardingCheckpointId(value: unknown): value is OnboardingCheckpointId {
  return typeof value === "string" && checkpointIds.has(value);
}

export function isOnboardingCheckpointStatus(value: unknown): value is OnboardingCheckpointStatus {
  return typeof value === "string" && checkpointStatuses.has(value as OnboardingCheckpointStatus);
}

function cleanText(value: unknown, maxLength = 320): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function cleanCapabilitySummary(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((item) => item.slice(0, 140));
  return cleaned.length ? cleaned : undefined;
}

export function sanitizeOnboardingProgressUpdate(value: unknown): OnboardingProgressUpdate | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const update: OnboardingProgressUpdate = {};

  if (Array.isArray(raw.checkpoints)) {
    const checkpoints: NonNullable<OnboardingProgressUpdate["checkpoints"]> = [];
    for (const candidate of raw.checkpoints) {
      if (!candidate || typeof candidate !== "object") continue;
      const entry = candidate as Record<string, unknown>;
      if (!isOnboardingCheckpointId(entry.id) || !isOnboardingCheckpointStatus(entry.status)) continue;
      checkpoints.push({
        id: entry.id,
        status: entry.status,
        value: cleanText(entry.value, 180),
      });
    }
    if (checkpoints.length) update.checkpoints = checkpoints;
  }

  if (raw.context && typeof raw.context === "object") {
    const context = raw.context as Record<string, unknown>;
    const mapPresence = context.mapPresence === "marker_ready" || context.mapPresence === "off_map"
      ? context.mapPresence
      : undefined;
    update.context = {
      organizationId: cleanText(context.organizationId, 120),
      organizationName: cleanText(context.organizationName, 180),
      geography: cleanText(context.geography, 180),
      visibility: cleanText(context.visibility, 120),
      mapPresence,
      capabilitySummary: cleanCapabilitySummary(context.capabilitySummary),
      amacsSummary: cleanText(context.amacsSummary, 180),
      entitlementSummary: cleanText(context.entitlementSummary, 180),
    };
  }

  return update;
}

export function mergeOnboardingProgress(
  current: OnboardingProgressState,
  update: OnboardingProgressUpdate,
  now = new Date().toISOString(),
): OnboardingProgressState {
  const checkpoints = { ...current.checkpoints };
  for (const checkpoint of update.checkpoints ?? []) {
    checkpoints[checkpoint.id] = { ...checkpoint, updatedAt: now };
  }

  const context = {
    ...current.context,
    ...Object.fromEntries(
      Object.entries(update.context ?? {}).filter(([, value]) => value !== undefined),
    ),
  } as OnboardingProgressContext;

  return {
    version: 1,
    checkpoints,
    context,
    activation: update.activation ?? current.activation,
    updatedAt: now,
  };
}

export function checkpointStatus(
  progress: OnboardingProgressState,
  id: OnboardingCheckpointId,
): OnboardingCheckpoint | undefined {
  return progress.checkpoints[id];
}
