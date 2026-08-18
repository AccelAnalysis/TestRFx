import Link from "next/link";
import {
  getOnboardingDetailBreadcrumbs,
  getOnboardingDetailNode,
  getOnboardingDetailParentHref,
  listOnboardingDetailDefinitions,
  onboardingDetailHref,
  type OnboardingDetailClassification,
  type OnboardingDetailDefinition,
  type OnboardingDetailNode,
  type OnboardingDetailSubject,
  type OnboardingWorkflowTarget,
} from "@/lib/onboarding/detail-surface";
import styles from "./onboarding-detail-surface.module.css";

function classificationLabel(classification: OnboardingDetailClassification) {
  switch (classification) {
    case "required": return "Required";
    case "recommended": return "Recommended";
    case "conditional": return "Conditional";
    default: return "Optional";
  }
}

function classificationClass(classification: OnboardingDetailClassification) {
  switch (classification) {
    case "required": return styles.required;
    case "recommended": return styles.recommended;
    case "conditional": return styles.conditional;
    default: return styles.optional;
  }
}

function addReturnTo(href: string, returnTo: string) {
  if (!href.startsWith("/")) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function isActiveBranch(activePath: readonly string[], path: readonly string[]) {
  return path.every((segment, index) => activePath[index] === segment);
}

function NodeTree({
  subject,
  nodes,
  activePath,
  prefix = [],
  returnHref,
}: {
  subject: OnboardingDetailSubject;
  nodes: readonly OnboardingDetailNode[];
  activePath: readonly string[];
  prefix?: readonly string[];
  returnHref: string;
}) {
  return (
    <ul className={styles.nodeTree}>
      {nodes.map((node) => {
        const path = [...prefix, node.id];
        const exact = activePath.length === path.length && isActiveBranch(activePath, path);
        const branch = isActiveBranch(activePath, path);
        const href = `${onboardingDetailHref(subject, path)}?returnTo=${encodeURIComponent(returnHref)}`;
        return (
          <li key={node.id}>
            <Link className={`${styles.treeLink} ${exact ? styles.activeTreeLink : ""}`} href={href} aria-current={exact ? "page" : undefined}>
              <span>{node.label}</span>
              <small>{classificationLabel(node.classification)}</small>
            </Link>
            {node.children?.length ? (
              <details className={styles.treeBranch} open={branch}>
                <summary aria-label={`${node.label} child workflows`}>{branch ? "Hide children" : "Show children"}</summary>
                <NodeTree subject={subject} nodes={node.children} activePath={activePath} prefix={path} returnHref={returnHref} />
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function WorkflowCard({ workflow, returnHref, currentHref }: { workflow: OnboardingWorkflowTarget; returnHref: string; currentHref: string }) {
  const workflowHref = addReturnTo(workflow.href, currentHref || returnHref);
  return (
    <section className={styles.workflowCard}>
      <div>
        <p className={styles.cardEyebrow}>Owning workflow</p>
        <h2>{workflow.label}</h2>
        <p>
          Detail Surface owns navigation and context. Canonical validation, authorization, persistence, payment, taxonomy, evidence, and activation stay with the owning domain workflow.
        </p>
      </div>
      <Link className={styles.primaryAction} href={workflowHref}>{workflow.label} →</Link>
      {workflow.service ? (
        <div className={styles.serviceBoundary}>
          <strong>Service boundary</strong>
          <code>{workflow.service.method} {workflow.service.endpoint}</code>
          {workflow.service.action ? <span>Action: {workflow.service.action}</span> : null}
          <span>{workflow.service.owner}</span>
          <p>{workflow.service.purpose}</p>
        </div>
      ) : (
        <div className={styles.serviceBoundary}>
          <strong>Workflow-owned service</strong>
          <p>No Detail-Surface mock API is substituted here. This item delegates to the owning workflow until that domain exposes its production service.</p>
        </div>
      )}
    </section>
  );
}

export function OnboardingDetailSurface({
  definition,
  activePath,
  returnHref,
}: {
  definition: OnboardingDetailDefinition;
  activePath: readonly string[];
  returnHref: string;
}) {
  const active = getOnboardingDetailNode(definition.subject, activePath);
  if (!active) return null;

  const activeLabel = "label" in active ? active.label : definition.label;
  const activeDescription = active.description;
  const activeClassification = active.classification;
  const activeWorkflow = active.workflow;
  const activeChildren = active.children;
  const breadcrumbs = getOnboardingDetailBreadcrumbs(definition.subject, activePath);
  const parentHref = getOnboardingDetailParentHref(definition.subject, activePath);
  const currentHref = onboardingDetailHref(definition.subject, activePath);
  const definitions = listOnboardingDetailDefinitions();
  const sourceLabels = "sources" in active ? active.sources : (["Project"] as const);

  return (
    <main className={styles.shell}>
      <div className={styles.workspace}>
        <aside className={styles.progressRail} aria-label="Identity and onboarding detail navigation">
          <Link className={styles.brand} href="/onboarding">RFxchange</Link>
          <p className={styles.railEyebrow}>Identity & onboarding</p>
          <nav className={styles.subjectTree} aria-label="Onboarding detail hierarchy">
            {definitions.map((subjectDefinition) => {
              const selected = subjectDefinition.subject === definition.subject;
              return (
                <section className={styles.subjectGroup} key={subjectDefinition.subject}>
                  <Link
                    className={`${styles.subjectLink} ${selected && activePath.length === 0 ? styles.activeSubjectLink : ""}`}
                    href={`${onboardingDetailHref(subjectDefinition.subject)}?returnTo=${encodeURIComponent(returnHref)}`}
                  >
                    <span className={styles.stepNumber}>{subjectDefinition.step}</span>
                    <span><strong>{subjectDefinition.label}</strong><small>{classificationLabel(subjectDefinition.classification)}</small></span>
                  </Link>
                  {selected ? (
                    <NodeTree
                      subject={definition.subject}
                      nodes={definition.children}
                      activePath={activePath}
                      returnHref={returnHref}
                    />
                  ) : null}
                </section>
              );
            })}
          </nav>
          <p className={styles.referenceNote}>
            Navigation configuration is shell-owned. Domain values are not duplicated here; workflow routes and APIs remain the source of truth.
          </p>
        </aside>

        <section className={styles.surface} aria-labelledby="detail-title">
          <header className={styles.topbar}>
            <Link className={styles.backLink} href={`${parentHref}?returnTo=${encodeURIComponent(returnHref)}`}>← Parent</Link>
            <Link className={styles.exitLink} href={returnHref}>Exit detail</Link>
          </header>

          <div className={styles.content}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href={`/onboarding/detail?returnTo=${encodeURIComponent(returnHref)}`}>Detail Surface</Link>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href}>
                  <span aria-hidden="true">/</span>
                  {index === breadcrumbs.length - 1 ? <strong>{crumb.label}</strong> : <Link href={`${crumb.href}?returnTo=${encodeURIComponent(returnHref)}`}>{crumb.label}</Link>}
                </span>
              ))}
            </nav>

            <div className={styles.contextHeader}>
              <div>
                <p className={styles.eyebrow}>Step {definition.step} of {definition.totalSteps} · {definition.label}</p>
                <h1 id="detail-title">{activeLabel}</h1>
                <p className={styles.description}>{activeDescription}</p>
              </div>
              <span className={`${styles.statusPill} ${classificationClass(activeClassification)}`}>{classificationLabel(activeClassification)}</span>
            </div>

            <div className={styles.progressBar} aria-label={`Step ${definition.step} of ${definition.totalSteps}`}>
              <span style={{ width: `${(definition.step / definition.totalSteps) * 100}%` }} />
            </div>

            <section className={styles.sourceCard}>
              <strong>Source trace</strong>
              <div>{sourceLabels.map((source) => <span key={source}>{source}</span>)}</div>
              <p>This node exists because it is represented in the source flow or the previously agreed Detail Surface structure; the hierarchy does not add unrelated product areas.</p>
            </section>

            {activeChildren?.length ? (
              <section className={styles.childrenSection}>
                <div className={styles.sectionHeading}>
                  <p className={styles.cardEyebrow}>Child workflows</p>
                  <h2>{activePath.length === 0 ? `${definition.label} submenu` : `${activeLabel} submenu`}</h2>
                  <p>Select a child to move deeper into the hierarchy. The URL carries the exact nested state.</p>
                </div>
                <div className={styles.childGrid}>
                  {activeChildren.map((child) => {
                    const childPath = [...activePath, child.id];
                    return (
                      <Link
                        className={styles.childCard}
                        href={`${onboardingDetailHref(definition.subject, childPath)}?returnTo=${encodeURIComponent(returnHref)}`}
                        key={child.id}
                      >
                        <div>
                          <span className={`${styles.miniPill} ${classificationClass(child.classification)}`}>{classificationLabel(child.classification)}</span>
                          <h3>{child.label}</h3>
                          <p>{child.description}</p>
                        </div>
                        <strong aria-hidden="true">›</strong>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className={styles.leafCard}>
                <p className={styles.cardEyebrow}>Leaf workflow</p>
                <h2>This item now leads to a concrete owning workflow.</h2>
                <p>There is no browser-only Detail Surface form or fabricated record behind this leaf. Use the owning workflow below for the actual action.</p>
              </section>
            )}

            <WorkflowCard workflow={activeWorkflow} returnHref={returnHref} currentHref={currentHref} />
          </div>

          <footer className={styles.actionBar}>
            <Link className={styles.secondaryAction} href={`${parentHref}?returnTo=${encodeURIComponent(returnHref)}`}>Parent</Link>
            <Link className={styles.secondaryAction} href={returnHref}>Exit detail</Link>
            <Link className={styles.primaryAction} href={addReturnTo(activeWorkflow.href, currentHref)}>{activeWorkflow.label}</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
