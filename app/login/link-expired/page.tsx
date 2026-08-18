import { CheckEmailPanel } from "@/components/identity/CheckEmailPanel";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { parseAuthEntryContext, type AuthEntrySearchParams } from "@/lib/acquisition/auth-entry";

export default async function LinkExpiredPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) { const context = parseAuthEntryContext(await searchParams); return <LoginWorkflowFrame nodeId="link-expired" title="Sign-in link expired" description="This RFxchange challenge is no longer within the 15-minute application window. Request a new link to continue safely."><CheckEmailPanel context={context} /></LoginWorkflowFrame>; }
