import Link from "next/link";
import type { ReactNode } from "react";
import { loginWorkflow, loginWorkflowAncestors, type LoginWorkflowNodeId } from "@/lib/identity/login-navigation";
import styles from "./login.module.css";
import workflow from "./login-workflow.module.css";

export function LoginWorkflowFrame({ nodeId, title, description, children }: { nodeId: LoginWorkflowNodeId; title: string; description: string; children: ReactNode }) {
  const ancestors = loginWorkflowAncestors(nodeId).filter((item) => item.id !== nodeId);
  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="login-state-title">
        <div className={styles.brandRow}><span className={styles.brandMark} aria-hidden="true">RF</span><span>RFxchange</span></div>
        <nav className={workflow.breadcrumbs} aria-label="Login workflow">
          {ancestors.map((item) => item.route ? <Link href={item.route} key={item.id}>{item.label}</Link> : <span key={item.id}>{item.label}</span>)}
          <span aria-current="step">{loginWorkflow[nodeId].label}</span>
        </nav>
        <p className={styles.eyebrow}>Identity &amp; onboarding</p>
        <h1 id="login-state-title" className={styles.title}>{title}</h1>
        <p className={styles.copy}>{description}</p>
        <div className={workflow.content}>{children}</div>
      </section>
    </main>
  );
}
