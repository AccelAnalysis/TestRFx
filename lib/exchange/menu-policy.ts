import type { MenuNode } from "./menu";

export type MenuDependencyState = "clear" | "unchecked" | "blocked";

export interface MenuPolicyState {
  visible: boolean;
  applicable: boolean;
  authorized: boolean;
  operational: boolean;
  dependencyState: MenuDependencyState;
  unavailableReason?: string;
  blockers?: string[];
}

/**
 * Reference policy for the chassis demo only.
 *
 * Production must replace this with server-resolved policy derived from the
 * authenticated user, active organization, role/permissions, record/workflow
 * context, commercial entitlement, and dependency checks.
 */
export function resolveReferenceMenuPolicy(node: MenuNode): MenuPolicyState {
  const operational = node.availability === "operational";

  return {
    visible: true,
    applicable: true,
    authorized: true,
    operational,
    dependencyState: node.destructive ? "unchecked" : "clear",
    unavailableReason: operational
      ? undefined
      : "The Menu destination is structurally defined, but its production service is not connected yet.",
  };
}

export function canExecuteMenuNode(policy: MenuPolicyState) {
  return policy.visible
    && policy.applicable
    && policy.authorized
    && policy.operational
    && policy.dependencyState === "clear";
}

export function canShowMenuNode(policy: MenuPolicyState) {
  return policy.visible;
}
