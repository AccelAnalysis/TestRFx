import Link from "next/link";
import {
  completionWorkflowTree,
  readinessItemSatisfied,
  type ExchangeReadinessSnapshot,
  type CompletionWorkflowNode,
} from "@/lib/onboarding/readiness";
import styles from "./exchange-ready-completion.module.css";

function pathOnly(href: string | undefined) {
  return href?.split("?")[0] ?? "";
}

function WorkflowNode({
  node,
  readiness,
  activePath,
  depth = 0,
}: {
  node: CompletionWorkflowNode;
  readiness?: ExchangeReadinessSnapshot;
  activePath: string;
  depth?: number;
}) {
  const item = node.checkpointId
    ? readiness?.items.find((candidate) => candidate.id === node.checkpointId)
    : undefined;
  const satisfied = item ? readinessItemSatisfied(item) : false;
  const attention = Boolean(item && item.blocking && !satisfied);
  const isActive = Boolean(node.href && pathOnly(node.href) === activePath);
  const content = (
    <>
      <span className={styles.treeStatus} aria-hidden="true">
        {item ? (satisfied ? "✓" : attention ? "!" : "·") : depth > 0 ? "·" : "›"}
      </span>
      <span>{node.label}</span>
    </>
  );

  return (
    <li className={`${styles.treeItem} ${depth > 0 ? styles.treeChild : ""}`}>
      {node.href ? (
        <Link className={`${styles.treeLink} ${isActive ? styles.treeLinkActive : ""}`} href={node.href} aria-current={isActive ? "page" : undefined}>
          {content}
        </Link>
      ) : (
        <div className={styles.treeLabel}>{content}</div>
      )}
      {node.children?.length ? (
        <ul className={styles.treeChildren}>
          {node.children.map((child) => (
            <WorkflowNode
              key={child.id}
              node={child}
              readiness={readiness}
              activePath={activePath}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CompletionNavigation({
  readiness,
  activePath,
}: {
  readiness?: ExchangeReadinessSnapshot;
  activePath: string;
}) {
  return (
    <nav className={styles.workflowNav} aria-label="Exchange-ready completion workflow">
      <div className={styles.workflowNavHeading}>
        <span>Completion workflow</span>
        <strong>Review → Activate → Exchange</strong>
      </div>
      {completionWorkflowTree.map((group) => (
        <section className={styles.workflowGroup} key={group.id}>
          <div className={styles.workflowGroupHeading}>
            <strong>{group.label}</strong>
            <small>{group.description}</small>
          </div>
          <ul className={styles.workflowTree}>
            {group.children.map((node) => (
              <WorkflowNode
                key={node.id}
                node={node}
                readiness={readiness}
                activePath={activePath}
              />
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
