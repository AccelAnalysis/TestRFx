import type { ExchangeLens, SearchFacetDefinition, SearchNavigationNode } from "./contracts";

const discoverChildren: SearchNavigationNode[] = [
  { id: "suggestions", label: "Suggestions", description: "Search records, organizations, geography, and lens concepts." },
  { id: "recent", label: "Recent searches", description: "Re-run or save searches you used recently." },
  { id: "saved", label: "Saved searches", description: "Run, rename, edit, alert on, or delete saved discovery criteria." },
];

const sharedRefineChildren: SearchNavigationNode[] = [
  { id: "shared-filters", label: "Shared filters", description: "Constrain map presence, organization ownership, and shared metadata." },
  { id: "lens-filters", label: "Lens filters", description: "Apply the active lens's domain-specific discovery criteria." },
  { id: "sort", label: "Sort", description: "Order results by relevance, recency, title, or geography." },
];

function geographyChildren(lens: ExchangeLens): SearchNavigationNode[] {
  const children: SearchNavigationNode[] = [
    { id: "exchange-geography", label: "Current Exchange geography", description: "Use the geography currently governing the Exchange view." },
    { id: "place", label: "Place / ZIP / locality", description: "Search a named city, county, state, ZIP, or locality." },
    { id: "radius", label: "Radius from map center", description: "Constrain located results to a distance from the current map center." },
    { id: "viewport", label: "Current map area", description: "Use the visible map bounds as the query geography." },
  ];
  if (lens === "resources" || lens === "capabilities") {
    children.push({ id: "service-area", label: "Service geography", description: "Find records whose service area covers the current map center." });
  }
  if (lens === "rfx") {
    children.push({ id: "performance-area", label: "Performance geography", description: "Find RFx records whose performance area covers the current map center." });
  }
  return children;
}

export function getSearchNavigationTree(lens: ExchangeLens): SearchNavigationNode {
  return {
    id: "root",
    label: "Universal Search",
    description: "Search the active Exchange lens without leaving the persistent shell.",
    children: [
      { id: "discover", label: "Discover", description: "Suggestions, recent searches, and saved searches.", children: discoverChildren },
      {
        id: "refine",
        label: "Refine results",
        description: "Shared filters, lens filters, geography, and sort.",
        children: [
          { id: "geography", label: "Geography & map", description: "Exchange geography, place, radius, viewport, and applicable service/performance areas.", children: geographyChildren(lens) },
          ...sharedRefineChildren,
        ],
      },
    ],
  };
}

export const lensSearchFacetDefinitions: Record<ExchangeLens, SearchFacetDefinition[]> = {
  rfx: [
    { key: "issuer", label: "Issuer", description: "Organization or agency issuing the RFx." },
    { key: "procurementType", label: "Procurement / request type", description: "Solicitation or request type." },
    { key: "capability", label: "Capability", description: "Capability or requirement represented by the RFx." },
    { key: "industry", label: "Industry", description: "Industry classification or market context." },
    { key: "naics", label: "NAICS", description: "NAICS codes associated with the opportunity." },
    { key: "status", label: "Status", description: "Current RFx lifecycle status." },
  ],
  resources: [
    { key: "provider", label: "Provider organization", description: "Organization offering or requesting the resource." },
    { key: "category", label: "Category / service", description: "Resource or service category." },
    { key: "eligibility", label: "Eligibility", description: "Eligibility criteria represented by the resource." },
    { key: "need", label: "Need", description: "Business need the resource addresses." },
    { key: "availability", label: "Availability / modality", description: "Availability or delivery modality." },
  ],
  intelligence: [
    { key: "organization", label: "Organization", description: "Organization represented by the intelligence record." },
    { key: "industry", label: "Industry", description: "Industry or sector context." },
    { key: "market", label: "Market", description: "Market represented by the insight." },
    { key: "capability", label: "Capability", description: "Capability associated with the signal." },
    { key: "signal", label: "Signal", description: "Signal or observation type." },
    { key: "dataset", label: "Dataset / trend", description: "Dataset, trend, or source context." },
  ],
  capabilities: [
    { key: "organization", label: "Organization", description: "Organization whose capabilities are being discovered." },
    { key: "capability", label: "Capability", description: "Capability text or category." },
    { key: "amacs", label: "AMACS", description: "AMACS taxonomy node or mapped category." },
    { key: "productsServices", label: "Products / services", description: "Products or services supported by the capability." },
    { key: "industry", label: "Industry", description: "Industry context for the organization or capability." },
    { key: "evidence", label: "Evidence", description: "Evidence or verification state." },
  ],
};

export function findSearchNavigationNode(root: SearchNavigationNode, id: SearchNavigationNode["id"]): SearchNavigationNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children ?? []) {
    const match = findSearchNavigationNode(child, id);
    if (match) return match;
  }
  return undefined;
}
