import {
  PUBLIC_DESTINATIONS,
  PUBLIC_FOOTER_GROUPS,
  type PublicDestinationId,
} from "./destinations";
import { PUBLIC_INFO_PAGES } from "./pages";

export type PublicNavigationNodeKind = "root" | "group" | "destination" | "section";

export type PublicNavigationNode = {
  id: string;
  label: string;
  kind: PublicNavigationNodeKind;
  href?: string;
  destinationId?: PublicDestinationId;
  children?: readonly PublicNavigationNode[];
};

function pageSections(destinationId: PublicDestinationId): readonly PublicNavigationNode[] {
  const page = Object.values(PUBLIC_INFO_PAGES).find(
    (candidate) => candidate.destinationId === destinationId,
  );

  if (!page) return [];

  return page.sections.map((section) => ({
    id: `${destinationId}:${section.id}`,
    label: section.heading,
    kind: "section" as const,
    href: `${PUBLIC_DESTINATIONS[destinationId].href}#${section.id}`,
    destinationId,
  }));
}

export const PUBLIC_FOOTER_NAVIGATION_TREE: PublicNavigationNode = {
  id: "public-acquisition-footer",
  label: "Public / Acquisition",
  kind: "root",
  children: PUBLIC_FOOTER_GROUPS.map((group) => ({
    id: `group:${group.id}`,
    label: group.label,
    kind: "group" as const,
    children: group.destinationIds.map((destinationId) => {
      const destination = PUBLIC_DESTINATIONS[destinationId];
      const children = pageSections(destinationId);

      return {
        id: `destination:${destinationId}`,
        label: destination.label,
        kind: "destination" as const,
        href: destination.href,
        destinationId,
        ...(children.length > 0 ? { children } : {}),
      };
    }),
  })),
};

export function findPublicNavigationPath(
  pathname: string,
  hash = "",
  root: PublicNavigationNode = PUBLIC_FOOTER_NAVIGATION_TREE,
): readonly PublicNavigationNode[] {
  const normalizedHash = hash.startsWith("#") ? hash : hash ? `#${hash}` : "";
  const exactHref = `${pathname}${normalizedHash}`;

  function walk(node: PublicNavigationNode, ancestors: readonly PublicNavigationNode[]): readonly PublicNavigationNode[] | undefined {
    if (node.href === exactHref || (!normalizedHash && node.href === pathname)) {
      return [...ancestors, node];
    }

    for (const child of node.children ?? []) {
      const found = walk(child, [...ancestors, node]);
      if (found) return found;
    }

    return undefined;
  }

  if (normalizedHash) {
    const exact = walk(root, []);
    if (exact) return exact;
  }

  function walkDestination(node: PublicNavigationNode, ancestors: readonly PublicNavigationNode[]): readonly PublicNavigationNode[] | undefined {
    if (node.kind === "destination" && node.href === pathname) {
      return [...ancestors, node];
    }
    for (const child of node.children ?? []) {
      const found = walkDestination(child, [...ancestors, node]);
      if (found) return found;
    }
    return undefined;
  }

  return walkDestination(root, []) ?? [root];
}
