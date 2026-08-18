export type AccountVerificationNodeKind = "root" | "workflow" | "task";

export type AccountVerificationNode = {
  id: string;
  label: string;
  kind: AccountVerificationNodeKind;
  description: string;
  children?: readonly AccountVerificationNode[];
};

export const accountVerificationTree: AccountVerificationNode = {
  id: "account-verification",
  label: "Account Verification",
  kind: "root",
  description: "Prove control of the account email before organization onboarding.",
  children: [
    {
      id: "verify-email-access",
      label: "Verify Email / Access",
      kind: "workflow",
      description: "The source-defined email verification workflow.",
      children: [
        {
          id: "send",
          label: "Send Verification Email",
          kind: "task",
          description: "Issue a one-time verification challenge and send it to the pending account email.",
        },
        {
          id: "verification-link",
          label: "Verification Link",
          kind: "task",
          description: "Consume the one-time link from the verification email and verify the account email.",
        },
        {
          id: "resend",
          label: "Resend Verification",
          kind: "task",
          description: "Supersede the previous challenge and send a replacement verification email.",
        },
        {
          id: "change-email",
          label: "Change Email Address",
          kind: "task",
          description: "Replace the pending account email, enforce duplicate detection, and send verification to the new address.",
        },
      ],
    },
  ],
};

export type AccountVerificationRoute = {
  path: string[];
  node: AccountVerificationNode;
};

function flatten(node: AccountVerificationNode, path: string[] = []): AccountVerificationRoute[] {
  const routes: AccountVerificationRoute[] = [{ path, node }];
  for (const child of node.children ?? []) {
    routes.push(...flatten(child, [...path, child.id]));
  }
  return routes;
}

export const accountVerificationRoutes = flatten(accountVerificationTree);

export function getAccountVerificationNode(path: readonly string[]): AccountVerificationNode | undefined {
  if (path.length === 0) return accountVerificationTree;

  let current: AccountVerificationNode = accountVerificationTree;
  for (const segment of path) {
    const next = current.children?.find((child) => child.id === segment);
    if (!next) return undefined;
    current = next;
  }
  return current;
}

export function getAccountVerificationBreadcrumbs(path: readonly string[]): AccountVerificationRoute[] {
  const breadcrumbs: AccountVerificationRoute[] = [{ path: [], node: accountVerificationTree }];
  let current = accountVerificationTree;
  const resolved: string[] = [];

  for (const segment of path) {
    const next = current.children?.find((child) => child.id === segment);
    if (!next) break;
    resolved.push(segment);
    breadcrumbs.push({ path: [...resolved], node: next });
    current = next;
  }

  return breadcrumbs;
}

export function accountVerificationPath(path: readonly string[]): string {
  return path.length
    ? `/onboarding/account-verification/${path.join("/")}`
    : "/onboarding/account-verification";
}
