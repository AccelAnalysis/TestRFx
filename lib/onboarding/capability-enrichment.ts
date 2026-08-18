export type CapabilityEnrichmentSectionId =
  | "core-profile-details"
  | "industry-services"
  | "capabilities-entry"
  | "amacs-mapping"
  | "evidence-certifications"
  | "tags-keywords-specialties";

export type CapabilityEnrichmentTaskId =
  | "organization-overview"
  | "contacts"
  | "description"
  | "key-info"
  | "industries-served"
  | "service-offerings"
  | "detailed-capabilities"
  | "solutions"
  | "ai-assistance"
  | "suggestions"
  | "certifications"
  | "licenses"
  | "case-studies"
  | "supporting-documents"
  | "tags"
  | "keywords"
  | "specialties";

export type CapabilityWorkflowOwner = "organization-profile" | "capability-enrichment";

export interface CapabilityWorkflowTask {
  id: CapabilityEnrichmentTaskId;
  label: string;
  description: string;
  owner: CapabilityWorkflowOwner;
}

export interface CapabilityWorkflowSection {
  id: CapabilityEnrichmentSectionId;
  label: string;
  description: string;
  children: readonly CapabilityWorkflowTask[];
}

export const CAPABILITY_ENRICHMENT_TREE: readonly CapabilityWorkflowSection[] = [
  {
    id: "core-profile-details",
    label: "Core Profile Details",
    description: "Organization overview, contacts, description, and key info.",
    children: [
      { id: "organization-overview", label: "Organization overview", description: "Review the organization identity used by Capability Enrichment.", owner: "organization-profile" },
      { id: "contacts", label: "Contacts", description: "Review the organization contacts that belong to the canonical profile.", owner: "organization-profile" },
      { id: "description", label: "Description", description: "Review the organization description used as capability context.", owner: "organization-profile" },
      { id: "key-info", label: "Key info", description: "Review the remaining canonical organization profile information.", owner: "organization-profile" },
    ],
  },
  {
    id: "industry-services",
    label: "Industry & Services",
    description: "Select industries served and service offerings.",
    children: [
      { id: "industries-served", label: "Industries served", description: "Maintain industries served in the canonical organization profile.", owner: "organization-profile" },
      { id: "service-offerings", label: "Service offerings", description: "Maintain service offerings used to inform capability entry.", owner: "organization-profile" },
    ],
  },
  {
    id: "capabilities-entry",
    label: "Capabilities Entry",
    description: "Add detailed capabilities and solutions.",
    children: [
      { id: "detailed-capabilities", label: "Detailed capabilities", description: "Create and maintain organization capability claims.", owner: "capability-enrichment" },
      { id: "solutions", label: "Solutions", description: "Describe the solution or approach associated with a capability claim.", owner: "capability-enrichment" },
    ],
  },
  {
    id: "amacs-mapping",
    label: "AMACS Mapping / AI-to-AMACS Assistance",
    description: "Map capabilities to AMACS structure with AI assistance and suggestions.",
    children: [
      { id: "ai-assistance", label: "AI assistance", description: "Request non-authoritative interpretation candidates from the configured interpretation service.", owner: "capability-enrichment" },
      { id: "suggestions", label: "Suggestions", description: "Search the deployed AMACS release and confirm a concept mapping.", owner: "capability-enrichment" },
    ],
  },
  {
    id: "evidence-certifications",
    label: "Evidence / Certifications",
    description: "Add certifications, licenses, case studies, and supporting documents.",
    children: [
      { id: "certifications", label: "Certifications", description: "Associate certification evidence with a capability claim.", owner: "capability-enrichment" },
      { id: "licenses", label: "Licenses", description: "Associate license evidence with a capability claim.", owner: "capability-enrichment" },
      { id: "case-studies", label: "Case studies", description: "Associate case-study evidence with a capability claim.", owner: "capability-enrichment" },
      { id: "supporting-documents", label: "Supporting documents", description: "Associate an authoritative document URL with a capability claim.", owner: "capability-enrichment" },
    ],
  },
  {
    id: "tags-keywords-specialties",
    label: "Tags / Keywords / Specialties",
    description: "Add keywords, specialties, and tags to improve discoverability.",
    children: [
      { id: "tags", label: "Tags", description: "Maintain organization capability-profile tags.", owner: "capability-enrichment" },
      { id: "keywords", label: "Keywords", description: "Maintain search terms without changing AMACS taxonomy truth.", owner: "capability-enrichment" },
      { id: "specialties", label: "Specialties", description: "Maintain specialties used for discovery and matching context.", owner: "capability-enrichment" },
    ],
  },
] as const;

export type CapabilityEvidenceKind = "certification" | "license" | "case-study" | "supporting-document";

export interface CapabilityEvidenceRecord {
  id: string;
  capabilityClaimId: string;
  kind: CapabilityEvidenceKind;
  label: string;
  issuer?: string;
  sourceUrl?: string;
  notes?: string;
}

export interface CapabilityClaimRecord {
  id: string;
  name: string;
  description: string;
  solution?: string;
  amacsReleaseId?: string;
  amacsReleaseVersion?: string;
  amacsConceptId?: string;
  amacsLabel?: string;
  mappingStatus: "unmapped" | "accepted";
  evidence: CapabilityEvidenceRecord[];
}

export interface CapabilityOrganizationContext {
  organizationId: string;
  organizationName: string;
  legalName?: string;
  description?: string;
  website?: string;
  industries: string[];
  services: string[];
  contacts: Array<{ id: string; name: string; title?: string; email: string; phone?: string }>;
}

export interface CapabilityEnrichmentProgress {
  lastPath: string[];
  completedLeafPaths: string[];
  updatedAt?: string;
}

export interface CapabilityEnrichmentSnapshot {
  organization: CapabilityOrganizationContext;
  claims: CapabilityClaimRecord[];
  tags: string[];
  keywords: string[];
  specialties: string[];
  amacsRelease?: { id: string; version: string; sourceCommitSha: string; importedAt: string };
  progress: CapabilityEnrichmentProgress;
}

export interface AmacsCandidate {
  releaseId: string;
  releaseVersion: string;
  conceptId: string;
  label: string;
  definition: string;
  parentId?: string;
  matchedAlias?: string;
  sourceCommitSha: string;
}

export function getCapabilityWorkflowSection(id?: string) {
  return CAPABILITY_ENRICHMENT_TREE.find((item) => item.id === id);
}

export function getCapabilityWorkflowTask(sectionId?: string, taskId?: string) {
  return getCapabilityWorkflowSection(sectionId)?.children.find((item) => item.id === taskId);
}

export function isCapabilityWorkflowPath(path: string[]) {
  if (path.length === 0) return true;
  const section = getCapabilityWorkflowSection(path[0]);
  if (!section) return false;
  if (path.length === 1) return true;
  return path.length === 2 && Boolean(section.children.find((item) => item.id === path[1]));
}

export function capabilityWorkflowHref(path: string[] = [], organizationId?: string) {
  const pathname = `/onboarding/capabilities${path.length ? `/${path.join("/")}` : ""}`;
  if (!organizationId) return pathname;
  const params = new URLSearchParams({ organizationId });
  return `${pathname}?${params.toString()}`;
}

export const CAPABILITY_ENRICHMENT_LEAF_PATHS = CAPABILITY_ENRICHMENT_TREE.flatMap((section) =>
  section.children.map((task) => [section.id, task.id] as const),
);
