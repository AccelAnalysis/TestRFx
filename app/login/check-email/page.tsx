import { CheckEmailPanel } from "@/components/identity/CheckEmailPanel";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";

export default async function CheckEmailPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) {
  const context = parseAuthEntryContext(await searchParams);
  return <LoginWorkflowFrame nodeId="check-email" title="Check your email" description="Open the RFxchange sign-in email and use its one-time link. The application challenge expires after 15 minutes."><CheckEmailPanel context={context} /></LoginWorkflowFrame>;
}
