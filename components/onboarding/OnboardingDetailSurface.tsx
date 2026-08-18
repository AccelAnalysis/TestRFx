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
  type OnboardingServiceMaturity,
  type OnboardingWorkflowTarget,
} from "@/lib/onboarding/detail-surface";
import styles from "./onboarding-detail-surface.module.css";

function classificationLabel(classification: OnboardingDetailClassification) {
  if (classification === "required") return "Required";
  if (classification === "recommended") return "Recommended";
  if (classification === "conditional") return "Conditional";
  return "Optional";
}

function classificationClass(classification: OnboardingDetailClassification) {
  if (classification === "required") return styles.required;
  if (classification === "recommended") return styles.recommended;
  if (classification === "conditional") return styles.conditional;
  return styles.optional;
}

function maturityLabel(maturity: OnboardingServiceMaturity) {
  if (maturity === "connected-reference") return "Connected API · reference adapter";
  if (maturity === "production-pending") return "Production service pending";
  return "Owning workflow only";
}

function withReturnTo(workflow: OnboardingWorkflowTarget, nestedReturnHref: string) {
  if (!workflow.preserveReturnTo) return workflow.href;
  const separator = workflow.href.includes("?") ? "&" : "?";
  return `${workflow.href}${separator}returnTo=${encodeURIComponent(nestedReturnHref)}`;
}

function withOuterReturn(href: string, returnHref: string) {
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnHref)}`;
}

function isActiveBranch(activePath: readonly string[], candidatePath: readonly string[]) {
  return candidatePath.every((segment, index) => activePath[index] === segment);
}

function NodeTree({
  subject,
  nodes,
  activePath,
  returnHref,
  prefix = [],
}: {
  subject: OnboardingDetailSubject;
  nodes: readonly OnboardingDetailNode[];
  activePath: readonly string[];
  returnHref: string;
  prefix?: readonly string[];
}) {
  return (
    <ul className={styles.nodeTree}>
      {nodes.map((item) => {
        const path = [...prefix, item.id];
        const branchActive = isActiveBranch(activePath, path);
        const exact = activePath.length === path.length && branchActive;
        return (
          <li key={item.id}>
            <Link
              className={`${styles.treeLink} ${exact ? styles.activeTreeLink : ""}`}
              href={withOuterReturn(onboardingDetailHref(subject, path), returnHref)}
              aria-current={exact ? "page" : undefined}
            >
              <span>{item.label}</span>
              <small>{classificationLabel(item.classification)}</small>
            </Link>
            {item.children?.length ? (
              <details className={styles.treeBranch} open={branchActive}>
                <summary>{branchActive ? "Hide children" : "Show children"}</summary>
                <NodeTree
                  subject={subject}
                  nodes={item.children}
                  activePath={activePath}
                  returnHref={returnHref}
                  prefix={path}
                />
              </details>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function WorkflowCard({ workflow, nestedReturnHref }: { workflow: OnboardingWorkflowTarget; nestedReturnHref: string }) {
  const destination = withReturnTo(workflow, nestedReturnHref);
  const { service } = workflow;
  return (
    <section className={styles.workflowCard}>
      <div>
        <p className={styles.cardEyebrow}>Owning workflow</p>
        <h2>{workflow.label}</h2>
        <p>
          Detail Surface owns the hierarchy and return context. Canonical validation, authorization, persistence, payment,
          taxonomy, evidence, and activation stay with the workflow that owns this item.
        </p>
      </div>
      <Link className={styles.primaryAction} href={destination}>{workflow.label} →</Link>
      <div className={styles.serviceBoundary}>
        <div className={styles.serviceHeading}>
          <strong>Service boundary</strong>
          <span className={styles.maturityPill}>{maturityLabel(service.maturity)}</span>
        </div>
        {service.endpoint ? <code>{service.method} {service.endpoint}{service.action ? ` · ${service.action}` : ""}</code> : null}
        <span>{service.owner}</span>
        <p>{service.purpose}</p>
      </div>
    </section>
  );
}

export function OnboardingDetailSurface({
  definition,
  activePath = [],
  returnHref = "/onboarding",
}: {
  definition: OnboardingDetailDefinition;
  activePath?: readonly string[];
  returnHref?: string;
}) {
  const active = getOnboardingDetailNode(definition.subject, activePath);
  if (!active) return null;

  const breadcrumbs = getOnboardingDetailBreadcrumbs(definition.subject, activePath);
  const parentHref = getOnboardingDetailParentHref(definition.subject, activePath);
  const currentHref = onboardingDetailHref(definition.subject, activePath);
  const nestedReturnHref = withOuterReturn(currentHref, returnHref);
  const definitions = listOnboardingDetailDefinitions();

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
                    href={withOuterReturn(onboardingDetailHref(subjectDefinition.subject), returnHref)}
                  >
                    <span className={styles.stepNumber}>{subjectDefinition.step}</span>
                    <span>
                      <strong>{subjectDefinition.label}</strong>
                      <small>{classificationLabel(subjectDefinition.classification)}</small>
                    </span>
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
            The tree is shell-owned. Domain values are not copied into Detail Surface; owning workflows and APIs retain their own truth.
          </p>
        </aside>

        <section className={styles.surface} aria-labelledby="detail-title">
          <header className={styles.topbar}>
            <Link className={styles.backLink} href={withOuterReturn(parentHref, returnHref)}>← Parent</Link>
            <Link className={styles.exitLink} href={returnHref}>Exit detail</Link>
          </header>

          <div className={styles.content}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
              <Link href={withOuterReturn("/onboarding/detail", returnHref)}>Detail Surface</Link>
              {breadcrumbs.map((crumb, index) => (
                <span key={crumb.href}>
                  <span aria-hidden="true">/</span>
                  {index === breadcrumbs.length - 1 ? (
                    <strong>{crumb.label}</strong>
                  ) : (
                    <Link href={withOuterReturn(crumb.href, returnHref)}>{crumb.label}</Link>
                  )}
                </span>
              ))}
            </nav>

            <div className={styles.contextHeader}>
              <div>
                <p className={styles.eyebrow}>Step {definition.step} of {definition.totalSteps} · {definition.label}</p>
                <h1 id="detail-title">{active.label}</h1>
                <p className={styles.description}>{active.description}</p>
              </div>
              <span className={`${styles.statusPill} ${classificationClass(active.classification)}`}>
                {classificationLabel(active.classification)}
              </span>
            </div>

            <div className={styles.progressBar} aria-label={`Step ${definition.step} of ${definition.totalSteps}`}>
              <span style={{ width: `${(definition.step / definition.totalSteps) * 100}%` }} />
            </div>

            <section className={styles.sourceCard}>
              <strong>Source trace</strong>
              <div>{active.sources.map((source) => <span key={source}>{source}</span>)}</div>
              <p>
                This node is represented in the supplied source flow or the previously agreed Detail Surface structure.
                The hierarchy does not add unrelated product destinations.
              </p>
            </section>

            {active.children?.length ? (
              <section className={styles.childrenSection}>
                <div className={styles.sectionHeading}>
                  <p className={styles.cardEyebrow}>Child workflows</p>
                  <h2>{active.label} submenu</h2>
                  <p>Select a child to move deeper. The nested URL is the navigation state, so direct links and refreshes preserve the exact branch.</p>
                </div>
                <div className={styles.childGrid}>
                  {active.children.map((child) => {
                    const childPath = [...activePath, child.id];
                    return (
                      <Link
                        className={styles.childCard}
                        href={withOuterReturn(onboardingDetailHref(definition.subject, childPath), returnHref)}
                        key={child.id}
                      >
                        <div>
                          <span className={`${styles.miniPill} ${classificationClass(child.classification)}`}>
                            {classificationLabel(child.classification)}
                          </span>
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
                <h2>This item has a concrete owner.</h2>
                <p>
                  No fake editable record or browser-only save is created here. Continue into the owning workflow for the actual action and validation.
                </p>
              </section>
            )}

            <WorkflowCard workflow={active.workflow} nestedReturnHref={nestedReturnHref} />
          </div>

          <footer className={styles.actionBar}>
            <Link className={styles.secondaryAction} href={withOuterReturn(parentHref, returnHref)}>Parent</Link>
            <Link className={styles.secondaryAction} href={returnHref}>Exit detail</Link>
            <Link className={styles.primaryAction} href={withReturnTo(active.workflow, nestedReturnHref)}>{active.workflow.label}</Link>
          </footer>
        </section>
      </div>
    </main>
  );
}
