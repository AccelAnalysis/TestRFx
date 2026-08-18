import Link from "next/link";
import { publicResourceTree, type PublicResourceNode } from "@/lib/public-content/navigation";

function branchIsActive(node: PublicResourceNode, activeHref: string) {
  return activeHref === node.href || activeHref.startsWith(`${node.href}/`);
}

function ResourceTreeBranch({ node, activeHref, depth }: { node: PublicResourceNode; activeHref: string; depth: number }) {
  const active = branchIsActive(node, activeHref);
  return (
    <li className={active ? "resource-tree-active" : undefined}>
      <Link
        href={node.href}
        aria-current={activeHref === node.href ? "page" : undefined}
        style={{ paddingInlineStart: `${12 + depth * 14}px` }}
      >
        <span>{node.label}</span>
        {node.children && node.children.length > 0 ? <small>{node.children.length}</small> : null}
      </Link>
      {node.children && node.children.length > 0 && active ? (
        <ul>
          {node.children.map((child) => (
            <ResourceTreeBranch key={child.id} node={child} activeHref={activeHref} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function ResourceTree({ activeHref }: { activeHref: string }) {
  return (
    <nav className="resource-tree" aria-label="Public resources hierarchy">
      <div className="resource-tree-heading">
        <p className="eyebrow">Resource library</p>
        <Link href="/resources" aria-current={activeHref === "/resources" ? "page" : undefined}>Resources Hub</Link>
      </div>
      <ul>
        {publicResourceTree.map((node) => (
          <ResourceTreeBranch key={node.id} node={node} activeHref={activeHref} depth={0} />
        ))}
      </ul>
    </nav>
  );
}
