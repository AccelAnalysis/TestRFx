import type { PublicAudience, PublicContentTopic, PublicContentType } from "@/lib/public-content/catalog";

export type PublicResourceNodeKind = "section" | "collection" | "audience" | "workflow";

export type PublicResourceNode = {
  id: string;
  label: string;
  description: string;
  href: string;
  kind: PublicResourceNodeKind;
  topic?: PublicContentTopic;
  audience?: PublicAudience;
  types?: PublicContentType[];
  exchangeHref?: `/exchange/${"rfx" | "resources" | "intelligence" | "capabilities"}`;
  downloadHref?: string;
  children?: PublicResourceNode[];
};

const node = (
  id: string,
  label: string,
  description: string,
  href: string,
  options: Omit<PublicResourceNode, "id" | "label" | "description" | "href">,
): PublicResourceNode => ({ id, label, description, href, ...options });

export const publicResourceTree: PublicResourceNode[] = [
  node("learn", "Learn / Guides", "Educational paths for understanding and preparing to use the Exchange.", "/resources/learn", {
    kind: "section",
    children: [
      node("learn-rfx-procurement", "RFx & procurement", "Understand RFx concepts, pursuit readiness, and procurement context.", "/resources/learn/rfx-procurement", { kind: "collection", topic: "RFx", exchangeHref: "/exchange/rfx" }),
      node("learn-finding-opportunities", "Finding opportunities", "Prepare to discover and evaluate opportunity records.", "/resources/learn/finding-opportunities", { kind: "collection", topic: "RFx", exchangeHref: "/exchange/rfx" }),
      node("learn-responding-to-rfx", "Responding to RFx", "Prepare requirements, ownership, capacity, and response decisions before authenticated response work.", "/resources/learn/responding-to-rfx", { kind: "collection", topic: "RFx", exchangeHref: "/exchange/rfx" }),
      node("learn-teaming-collaboration", "Teaming & collaboration", "Prepare partner criteria and collaboration decisions without creating another Exchange lens.", "/resources/learn/teaming-collaboration", { kind: "collection", topic: "Teaming & Referrals", exchangeHref: "/exchange/capabilities" }),
      node("learn-referrals", "Referrals", "Understand the cross-lens referral model before initiating a referral in the Exchange.", "/resources/learn/referrals", { kind: "collection", topic: "Teaming & Referrals" }),
      node("learn-capabilities", "Capabilities", "Understand reusable organization capability information and evidence context.", "/resources/learn/capabilities", {
        kind: "collection",
        topic: "Capabilities",
        exchangeHref: "/exchange/capabilities",
        children: [
          node("learn-capabilities-amacs", "AMACS education", "Learn how governed AMACS capability language relates to RFxchange discovery and matching.", "/resources/learn/capabilities/amacs", { kind: "collection", topic: "Capabilities", exchangeHref: "/exchange/capabilities" }),
        ],
      }),
      node("learn-resource-exchange", "Resource exchange", "Prepare resource offers and requests while keeping transactions inside the authenticated Resources lens.", "/resources/learn/resource-exchange", { kind: "collection", topic: "Resources", exchangeHref: "/exchange/resources" }),
      node("learn-market-intelligence", "Market intelligence", "Understand public market briefs, geography, capability supply, and demand before interactive analysis.", "/resources/learn/market-intelligence", { kind: "collection", topic: "Intelligence", exchangeHref: "/exchange/intelligence" }),
      node("learn-rfxchange-how-to", "RFxchange how-to content", "Learn the four-lens operating model and the public-to-authenticated handoff.", "/resources/learn/rfxchange-how-to", { kind: "collection" }),
    ],
  }),
  node("templates", "Templates / Tools", "Downloadable preparation tools that do not mutate Exchange records.", "/resources/templates", {
    kind: "section",
    children: [
      node("templates-rfx-readiness", "RFx readiness checklists", "A concrete pursuit-readiness checklist for opportunity evaluation.", "/resources/templates/rfx-readiness", { kind: "collection", types: ["template"], topic: "RFx", downloadHref: "/resources/downloads/rfx-readiness-checklist.md" }),
      node("templates-capability-statement", "Capability statement resources", "A structured outline for communicating organization capability information.", "/resources/templates/capability-statement", { kind: "collection", topic: "Capabilities", downloadHref: "/resources/downloads/capability-statement-outline.md" }),
      node("templates-capability-discovery", "Capability discovery worksheets", "A worksheet for identifying deliverable capabilities, geography, evidence, and gaps.", "/resources/templates/capability-discovery", { kind: "collection", topic: "Capabilities", downloadHref: "/resources/downloads/capability-discovery-worksheet.md" }),
      node("templates-teaming-partner", "Teaming / partner checklists", "A partner-evaluation checklist tied to a known delivery or requirement gap.", "/resources/templates/teaming-partner", { kind: "collection", topic: "Teaming & Referrals", downloadHref: "/resources/downloads/teaming-partner-checklist.md" }),
      node("templates-referral-preparation", "Referral preparation resources", "A preparation checklist for a useful, traceable referral handoff.", "/resources/templates/referral-preparation", { kind: "collection", topic: "Teaming & Referrals", downloadHref: "/resources/downloads/referral-preparation-checklist.md" }),
      node("templates-resource-offer-request", "Resource offer/request preparation", "A worksheet for resource description, availability, geography, terms, and organization context.", "/resources/templates/resource-offer-request", { kind: "collection", topic: "Resources", downloadHref: "/resources/downloads/resource-offer-request-worksheet.md" }),
      node("templates-downloads", "Downloadable worksheets / templates", "The complete set of source-controlled public preparation assets.", "/resources/templates/downloads", { kind: "collection", types: ["template"] }),
    ],
  }),
  node("insights", "Insights / Research", "Published public analysis and explanatory research; live interactive intelligence remains authenticated.", "/resources/insights", {
    kind: "section",
    children: [
      node("insights-market-briefs", "Market briefs", "Published public market explainers and briefs.", "/resources/insights/market-briefs", { kind: "collection", types: ["insight"], topic: "Intelligence" }),
      node("insights-regional-briefs", "Regional briefs", "Public analysis organized around geography and regional context.", "/resources/insights/regional-briefs", { kind: "collection", types: ["insight"], topic: "Intelligence" }),
      node("insights-industry-briefs", "Industry briefs", "Published industry-focused public research.", "/resources/insights/industry-briefs", { kind: "collection", types: ["insight"] }),
      node("insights-procurement-insights", "Procurement insights", "Public commentary that helps visitors interpret RFx and procurement activity.", "/resources/insights/procurement-insights", { kind: "collection", types: ["insight", "guide"], topic: "RFx" }),
      node("insights-capability-supply-demand", "Capability supply / demand commentary", "Public commentary on visible capability concentration and demand context.", "/resources/insights/capability-supply-demand", { kind: "collection", types: ["insight"], topic: "Intelligence" }),
      node("insights-rfx-trends", "RFx trend analysis", "Published public analysis of RFx activity when a governed dataset supports it.", "/resources/insights/rfx-trends", { kind: "collection", types: ["insight"], topic: "RFx" }),
      node("insights-selected-public-intelligence", "Selected public intelligence", "Publicly releasable Intelligence material; dynamic records and overlays stay inside the Intelligence lens.", "/resources/insights/selected-public-intelligence", { kind: "collection", types: ["insight"], topic: "Intelligence", exchangeHref: "/exchange/intelligence" }),
    ],
  }),
  node("stories", "Stories / Examples", "Published examples and use cases. Unverified success claims are not created to fill this section.", "/resources/stories", {
    kind: "section",
    children: [
      node("stories-business-success", "Business success stories", "Published business outcomes only when RFxchange has a real, attributable story.", "/resources/stories/business-success", { kind: "collection", types: ["case-study"] }),
      node("stories-buyer-use-cases", "Buyer use cases", "Published examples focused on buyer discovery and market understanding.", "/resources/stories/buyer-use-cases", { kind: "collection", types: ["example", "case-study"], audience: "Buyers" }),
      node("stories-resource-provider-use-cases", "Resource-provider use cases", "Published examples focused on preparing and connecting resource offers or requests.", "/resources/stories/resource-provider-use-cases", { kind: "collection", types: ["example", "case-study"], audience: "Resource Providers" }),
      node("stories-teaming-examples", "Teaming examples", "Illustrative teaming paths that are explicitly labeled as examples.", "/resources/stories/teaming-examples", { kind: "collection", types: ["example"], topic: "Teaming & Referrals" }),
      node("stories-referral-connection-examples", "Referral / connection examples", "Illustrative cross-lens referral and connection paths.", "/resources/stories/referral-connection-examples", { kind: "collection", types: ["example"], topic: "Teaming & Referrals" }),
    ],
  }),
  node("reference", "Reference", "Stable terminology and platform explanations.", "/resources/reference", {
    kind: "section",
    children: [
      node("reference-rfxchange-glossary", "RFxchange glossary", "Core RFxchange operating terms.", "/resources/reference/rfxchange-glossary", { kind: "collection", types: ["reference"] }),
      node("reference-rfx-terminology", "RFx terminology", "RFx and opportunity terminology used in the public learning layer.", "/resources/reference/rfx-terminology", { kind: "collection", types: ["reference"], topic: "RFx" }),
      node("reference-amacs-overview", "AMACS overview", "Public explanation of AMACS in the RFxchange capability model.", "/resources/reference/amacs-overview", { kind: "collection", types: ["reference"], topic: "Capabilities" }),
      node("reference-capability-terminology", "Capability terminology", "Reference language for capability claims, evidence, mapping, and gaps.", "/resources/reference/capability-terminology", { kind: "collection", types: ["reference", "guide"], topic: "Capabilities" }),
      node("reference-resource-categories", "Resource categories", "Reference guidance for describing Exchange resource offers and requests.", "/resources/reference/resource-categories", { kind: "collection", types: ["reference", "guide"], topic: "Resources" }),
      node("reference-faq-help", "FAQ / help articles", "Public help and orientation material for entering RFxchange.", "/resources/reference/faq-help", { kind: "collection", types: ["reference", "guide"] }),
    ],
  }),
  node("events", "Events / Learning", "Public learning-event collections. RFxchange only lists an event when a real event record is published.", "/resources/events", {
    kind: "section",
    children: [
      node("events-webinars", "Webinars", "Published webinar records.", "/resources/events/webinars", { kind: "collection", types: ["event"] }),
      node("events-workshops", "Workshops", "Published workshop records.", "/resources/events/workshops", { kind: "collection", types: ["event"] }),
      node("events-recorded-sessions", "Recorded sessions", "Published recorded learning sessions.", "/resources/events/recorded-sessions", { kind: "collection", types: ["event"] }),
      node("events-community-education", "Community education", "Published community learning opportunities.", "/resources/events/community-education", { kind: "collection", types: ["event"] }),
      node("events-detail-registration", "Event detail / registration", "Published event detail pages expose the real registration destination supplied by that event; this collection does not fabricate registrations.", "/resources/events/detail-registration", { kind: "workflow", types: ["event"] }),
    ],
  }),
  node("audiences", "Explore by audience", "Audience paths carried forward from the public Marketing flow.", "/resources/audiences", {
    kind: "section",
    children: [
      node("audience-businesses", "Businesses", "Content for businesses preparing capabilities, RFx pursuits, resource needs, partners, and market context.", "/resources/audiences/businesses", { kind: "audience", audience: "Businesses" }),
      node("audience-buyers", "Buyers", "Content for buyers exploring capability discovery, suppliers, geography, and market context.", "/resources/audiences/buyers", { kind: "audience", audience: "Buyers" }),
      node("audience-resource-providers", "Resource Providers", "Content for providers preparing offers, availability, service geography, and connection-ready information.", "/resources/audiences/resource-providers", { kind: "audience", audience: "Resource Providers" }),
    ],
  }),
];

export function flattenPublicResourceTree(nodes: PublicResourceNode[] = publicResourceTree): PublicResourceNode[] {
  return nodes.flatMap((item) => [item, ...flattenPublicResourceTree(item.children ?? [])]);
}

export const publicResourceNodes = flattenPublicResourceTree();

export function findPublicResourceNodeByHref(href: string) {
  return publicResourceNodes.find((item) => item.href === href);
}

export function publicResourceBreadcrumbs(href: string) {
  const lineage: PublicResourceNode[] = [];

  function visit(nodes: PublicResourceNode[], parents: PublicResourceNode[]): boolean {
    for (const item of nodes) {
      if (item.href === href) {
        lineage.push(...parents, item);
        return true;
      }
      if (item.children && visit(item.children, [...parents, item])) return true;
    }
    return false;
  }

  visit(publicResourceTree, []);
  return lineage;
}

export function publicResourceParamsForSection(sectionHref: string) {
  const root = findPublicResourceNodeByHref(sectionHref);
  if (!root) return [] as { path: string[] }[];
  const prefix = `${sectionHref}/`;
  return [
    { path: [] },
    ...flattenPublicResourceTree(root.children ?? []).map((item) => ({
      path: item.href.slice(prefix.length).split("/").filter(Boolean),
    })),
  ];
}
