import { CheckEmailPanel } from "@/components/identity/CheckEmailPanel";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";

export default async function LinkInvalidPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) { const context = parseAuthEntryContext(await searchParams); return <LoginWorkflowFrame nodeId="invalid-link" title="Sign-in link could not be verified" description="The link is invalid, already used, or was altered. RFxchange will not create a session from it."><CheckEmailPanel context={context} /></LoginWorkflowFrame>; }
