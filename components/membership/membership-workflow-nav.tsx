import Link from "next/link";
import { registrationMembershipTree } from "@/lib/membership/navigation";
import styles from "@/app/onboarding/membership/membership.module.css";

export function MembershipWorkflowNav({ currentStage }: { currentStage: string }) {
  return (
    <nav className={styles.workflowNav} aria-label="Registration membership workflow">
      {(registrationMembershipTree.children ?? []).map((step) => {
        const active = step.id === currentStage;
        const content = (
          <>
            <strong>{step.label}</strong>
            <span>{step.description}</span>
            {active && step.children?.length ? (
              <ul>
                {step.children.map((child) => <li key={child.id}>{child.label}</li>)}
              </ul>
            ) : null}
          </>
        );
        return step.href ? (
          <Link className={`${styles.workflowStep} ${active ? styles.workflowStepActive : ""}`} href={step.href} key={step.id} aria-current={active ? "step" : undefined}>
            {content}
          </Link>
        ) : (
          <div className={`${styles.workflowStep} ${active ? styles.workflowStepActive : ""}`} key={step.id}>{content}</div>
        );
      })}
    </nav>
  );
}
