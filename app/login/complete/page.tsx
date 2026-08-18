import { LoginCompleteClient } from "@/components/identity/LoginCompleteClient";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";
import { sanitizeReturnTo } from "@/lib/identity/login";
import workflow from "@/components/identity/login-workflow.module.css";

export default async function CompleteLoginPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams & { challenge?: string | string[]; remember?: string | string[] }> }) {
  const params = await searchParams;
  const challengeId = Array.isArray(params.challenge) ? params.challenge[0] : params.challenge;
  const remember = (Array.isArray(params.remember) ? params.remember[0] : params.remember) === "1";
  const context = parseAuthEntryContext(params);
  if (!challengeId) return <LoginWorkflowFrame nodeId="invalid-link" title="This sign-in link is not valid" description="The RFxchange challenge identifier is missing."><a className={workflow.primary} href="/login">Return to Login</a></LoginWorkflowFrame>;
  return <LoginWorkflowFrame nodeId="authenticate" title="Complete secure sign-in" description="RFxchange will verify the Firebase email-link credential, request an enrolled second factor when required, and only then establish the server session."><LoginCompleteClient challengeId={challengeId} rememberDevice={remember} returnTo={sanitizeReturnTo(context.returnTo)} /></LoginWorkflowFrame>;
}
