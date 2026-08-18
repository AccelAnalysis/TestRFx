import Link from "next/link";
import {
  buildCampaignNavigationTree,
  campaignWorkflowLinks,
  getCampaign,
  getCampaignFamily,
  type CampaignDefinition,
  type CampaignFamily,
  type CampaignNavigationNode,
} from "@/lib/public/campaigns";

function TreeNode({
  node,
  activeFamily,
  activeCampaign,
  depth = 0,
}: {
  node: CampaignNavigationNode;
  activeFamily?: CampaignFamily;
  activeCampaign?: string;
  depth?: number;
}) {
  const hasChildren = Boolean(node.children?.length);
  const isActive = node.id === activeFamily || node.id === activeCampaign;
  const containsActive = Boolean(
    node.children?.some((child) => child.id === activeFamily || child.id === activeCampaign),
  );

  if (!hasChildren) {
    return (
      <li className="campaign-tree-leaf" data-depth={depth}>
        <Link aria-current={isActive ? "page" : undefined} href={node.href}>
          {node.label}
        </Link>
      </li>
    );
  }

  return (
    <li className="campaign-tree-branch" data-depth={depth}>
      <details open={depth === 0 || isActive || containsActive}>
        <summary>
          <Link aria-current={isActive ? "page" : undefined} href={node.href}>
            {node.label}
          </Link>
        </summary>
        <ul>
          {node.children?.map((child) => (
            <TreeNode
              activeCampaign={activeCampaign}
              activeFamily={activeFamily}
              depth={depth + 1}
              key={child.id}
              node={child}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function CampaignHierarchy({
  activeFamily,
  activeCampaign,
}: {
  activeFamily?: CampaignFamily;
  activeCampaign?: string;
}) {
  const tree = buildCampaignNavigationTree();

  return (
    <aside className="campaign-tree" aria-label="Campaign landing page hierarchy">
      <p className="eyebrow">Campaign navigation</p>
      <ul className="campaign-tree-root">
        <TreeNode activeCampaign={activeCampaign} activeFamily={activeFamily} node={tree} />
      </ul>
    </aside>
  );
}

export function CampaignBreadcrumbs({
  family,
  campaign,
}: {
  family?: CampaignFamily;
  campaign?: CampaignDefinition;
}) {
  const familyDefinition = family ? getCampaignFamily(family) : undefined;

  return (
    <nav className="campaign-breadcrumbs" aria-label="Campaign breadcrumbs">
      <Link href="/campaign">Campaigns</Link>
      {familyDefinition ? (
        <>
          <span aria-hidden="true">/</span>
          <Link href={`/campaign/families/${familyDefinition.id}`}>{familyDefinition.label}</Link>
        </>
      ) : null}
      {campaign ? (
        <>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{campaign.eyebrow}</span>
        </>
      ) : null}
    </nav>
  );
}

export function CampaignWorkflowNavigation({ campaign }: { campaign: CampaignDefinition }) {
  const current = getCampaign(campaign.slug);
  if (!current) return null;

  return (
    <section className="campaign-workflow-nav" aria-labelledby="campaign-workflow-heading">
      <div>
        <p className="eyebrow">Concrete workflow</p>
        <h2 id="campaign-workflow-heading">From this campaign to a real RFxchange destination.</h2>
        <p>
          These are the campaign&apos;s child actions. Identity links preserve the protected Exchange
          destination and continue through the existing Join or Sign In gateways rather than
          bypassing readiness.
        </p>
      </div>
      <ol>
        {campaignWorkflowLinks(current).map((workflow) => (
          <li key={workflow.id}>
            <Link href={workflow.href}>
              <strong>{workflow.label}</strong>
              <span>{workflow.description}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
