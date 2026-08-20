export type CapabilityNavigationNodeId =
  | "open-capabilities"
  | "own-organization"
  | "current-profile"
  | "manage-capabilities"
  | "ai-amacs"
  | "capability-evidence"
  | "capability-gaps"
  | "save-publish"
  | "exchange-available"
  | "other-organization"
  | "browse-organizations"
  | "view-capabilities"
  | "match-rfx"
  | "decide-next-action"
  | "refer"
  | "cross-lens-referral"
  | "save-follow"
  | "saved-organizations"
  | "open-detail"
  | "capability-detail";

export interface CapabilityNavigationNode {
  id: CapabilityNavigationNodeId;
  label: string;
  description: string;
  scope: "lens" | "own" | "other";
  requiresSelectedOther?: boolean;
  children?: CapabilityNavigationNode[];
}

const ownBranch: CapabilityNavigationNode = {
  id: "own-organization", label: "Own Organization View", description: "Manage the active organization capability profile.", scope: "own",
  children: [{
    id: "current-profile", label: "View current capability profile", description: "Inspect the profile currently represented in the Exchange.", scope: "own",
    children: [{
      id: "manage-capabilities", label: "Manage Capabilities", description: "Maintain the organization capability claims.", scope: "own",
      children: [{
        id: "ai-amacs", label: "AI → AMACS Mapping", description: "Review governed AMACS interpretation candidates or map manually.", scope: "own",
        children: [{
          id: "capability-evidence", label: "Add / Edit Evidence", description: "Associate supporting evidence with capability claims.", scope: "own",
          children: [{
            id: "capability-gaps", label: "Identify Capability Gaps", description: "Review profile and requirement gaps.", scope: "own",
            children: [{
              id: "save-publish", label: "Save / Publish updates", description: "Persist the edited profile and publish eligible claims.", scope: "own",
              children: [{ id: "exchange-available", label: "Capability profile available in Exchange", description: "Confirm the published Exchange projection.", scope: "own" }],
            }],
          }],
        }],
      }],
    }],
  }],
};

const otherBranch: CapabilityNavigationNode = {
  id: "other-organization", label: "Other Organization View", description: "Discover and evaluate other organizations.", scope: "other",
  children: [{
    id: "browse-organizations", label: "Browse / search organizations", description: "Use the shared Exchange search, map, and results drawer.", scope: "other",
    children: [{
      id: "view-capabilities", label: "View Capabilities", description: "Open the selected organization capability profile.", scope: "other", requiresSelectedOther: true,
      children: [{
        id: "match-rfx", label: "Match to RFx / requirement", description: "Compare the selected profile with structured RFx requirements.", scope: "other", requiresSelectedOther: true,
        children: [{
          id: "decide-next-action", label: "Decide next action", description: "Choose one of the source-defined next actions.", scope: "other", requiresSelectedOther: true,
          children: [
            { id: "refer", label: "Refer", description: "Create a cross-lens referral for the selected organization.", scope: "other", requiresSelectedOther: true, children: [{ id: "cross-lens-referral", label: "Cross-lens referral workflow", description: "Continue the created referral through the shared workflow service.", scope: "other", requiresSelectedOther: true }] },
            { id: "save-follow", label: "Save / Follow", description: "Persist the organization relationship.", scope: "other", requiresSelectedOther: true, children: [{ id: "saved-organizations", label: "Watchlist / saved organizations", description: "Open the shared Saved & Watchlist management surface.", scope: "other" }] },
            { id: "open-detail", label: "Open detail", description: "Open the shared detail controller for the selected organization.", scope: "other", requiresSelectedOther: true, children: [{ id: "capability-detail", label: "Capability detail / supporting evidence", description: "Inspect claims, AMACS alignment, and supporting evidence.", scope: "other", requiresSelectedOther: true }] },
          ],
        }],
      }],
    }],
  }],
};

export const capabilityNavigationTree: CapabilityNavigationNode = {
  id: "open-capabilities", label: "Open Capabilities Lens", description: "Use the Capabilities projection inside the persistent Exchange.", scope: "lens", children: [ownBranch, otherBranch],
};

export const capabilitySharedOutcomes = ["Capability visibility in Exchange", "Requirement-to-capability matching", "Teaming / referral opportunities", "Capability intelligence inputs"] as const;

export function flattenCapabilityNavigation(node: CapabilityNavigationNode = capabilityNavigationTree): CapabilityNavigationNode[] {
  return [node, ...(node.children?.flatMap((child) => flattenCapabilityNavigation(child)) ?? [])];
}

export const capabilityNavigationById = Object.fromEntries(flattenCapabilityNavigation().map((node) => [node.id, node])) as Record<CapabilityNavigationNodeId, CapabilityNavigationNode>;

export function capabilityNavigationPath(target: CapabilityNavigationNodeId, node: CapabilityNavigationNode = capabilityNavigationTree, path: CapabilityNavigationNodeId[] = []): CapabilityNavigationNodeId[] {
  const nextPath = [...path, node.id];
  if (node.id === target) return nextPath;
  for (const child of node.children ?? []) { const found = capabilityNavigationPath(target, child, nextPath); if (found.length) return found; }
  return [];
}
