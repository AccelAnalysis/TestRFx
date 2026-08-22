export type OrganizationProfileNodeId =
  | "organization-details"
  | "basic-information"
  | "contact-address"
  | "industry-codes"
  | "certifications"
  | "description"
  | "logo-branding"
  | "verified-information"
  | "capabilities-amacs"
  | "locations"
  | "team-members"
  | "team-list"
  | "roles-permissions"
  | "invitations"
  | "access-management"
  | "documents-evidence"
  | "brand-visibility";

export type OrganizationProfileNavigationNode = {
  id: OrganizationProfileNodeId;
  label: string;
  description: string;
  children?: OrganizationProfileNavigationNode[];
};

export const ORGANIZATION_PROFILE_TREE: readonly OrganizationProfileNavigationNode[] = [
  {
    id: "organization-details",
    label: "Organization Details",
    description: "Edit the organization identity and public presentation details.",
    children: [
      { id: "basic-information", label: "Basic Information", description: "Organization name, legal name, website, and domain." },
      { id: "contact-address", label: "Contact & Address", description: "Primary organization contact plus the canonical Geography handoff." },
      { id: "industry-codes", label: "Industry & Codes", description: "Industry and classification codes." },
      { id: "certifications", label: "Certifications", description: "Continue to the capability evidence and certification workflow." },
      { id: "description", label: "Description", description: "Maintain the organization overview used across the Exchange." },
      { id: "logo-branding", label: "Logo & Media", description: "Manage your logo and short organization introduction video." },
    ],
  },
  { id: "verified-information", label: "Verified Information", description: "Read the organization facts that have been independently verified." },
  { id: "capabilities-amacs", label: "Capabilities (AMACS)", description: "Continue to the canonical Capability Enrichment workflow." },
  { id: "locations", label: "Locations", description: "Continue to the canonical Geography workflow for locations and service areas." },
  {
    id: "team-members",
    label: "Team Members",
    description: "Manage organization membership and access.",
    children: [
      { id: "team-list", label: "Team List", description: "View current organization members." },
      { id: "roles-permissions", label: "Roles & Permissions", description: "Update member role and permission assignments." },
      { id: "invitations", label: "Invitations", description: "Create and revoke durable organization invitations." },
      { id: "access-management", label: "Access Management", description: "Remove organization access while preserving ownership safeguards." },
    ],
  },
  { id: "documents-evidence", label: "Documents & Evidence", description: "Continue to the capability evidence workflow that owns supporting documents." },
  { id: "brand-visibility", label: "Brand & Visibility Settings", description: "Control Exchange search, map, contact, and brand presentation." },
] as const;

export type OrganizationProfilePath = string[];

function collectPaths(nodes: readonly OrganizationProfileNavigationNode[], prefix: string[] = []): string[][] {
  return nodes.flatMap((node) => {
    const path = [...prefix, node.id];
    return [path, ...(node.children ? collectPaths(node.children, path) : [])];
  });
}

export const ORGANIZATION_PROFILE_STATIC_PATHS = collectPaths(ORGANIZATION_PROFILE_TREE);

export function resolveOrganizationProfilePath(path: readonly string[] | undefined) {
  if (!path || path.length === 0) return undefined;
  let nodes: readonly OrganizationProfileNavigationNode[] = ORGANIZATION_PROFILE_TREE;
  let current: OrganizationProfileNavigationNode | undefined;
  for (const segment of path) {
    current = nodes.find((node) => node.id === segment);
    if (!current) return undefined;
    nodes = current.children ?? [];
  }
  return current;
}

export function organizationProfileBreadcrumbs(path: readonly string[]) {
  const crumbs: OrganizationProfileNavigationNode[] = [];
  let nodes: readonly OrganizationProfileNavigationNode[] = ORGANIZATION_PROFILE_TREE;
  for (const segment of path) {
    const node = nodes.find((candidate) => candidate.id === segment);
    if (!node) break;
    crumbs.push(node);
    nodes = node.children ?? [];
  }
  return crumbs;
}

export function organizationProfileHref(path: readonly string[], organizationId?: string, returnTo?: string) {
  const pathname = path.length > 0
    ? `/onboarding/organization-profile/${path.join("/")}`
    : "/onboarding/organization-profile";
  const params = new URLSearchParams();
  if (organizationId) params.set("organization", organizationId);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
