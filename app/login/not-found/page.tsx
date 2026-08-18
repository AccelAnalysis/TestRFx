import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { buildIdentityHref, parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";
import workflow from "@/components/identity/login-workflow.module.css";

export default async function EmailNotFoundPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) {
  const context = parseAuthEntryContext(await searchParams);
  return <LoginWorkflowFrame nodeId="email-not-found" title="Email not found" description="RFxchange did not find a registered participant for that email address."><div className={workflow.actions}><a className={workflow.primary} href={buildIdentityHref("register", context)}>Create an account</a><a className={workflow.secondary} href="/">Return to RFxchange</a></div></LoginWorkflowFrame>;
}
