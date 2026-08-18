import Link from "next/link";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { parseAuthEntryContext, type AuthEntrySearchParams, withAuthEntryContext } from "@/lib/acquisition/auth-entry";
import workflow from "@/components/identity/login-workflow.module.css";

export default async function SessionExpiredPage({ searchParams }: { searchParams: Promise<AuthEntrySearchParams> }) { const context = parseAuthEntryContext(await searchParams); return <LoginWorkflowFrame nodeId="session-timeout" title="Your session ended" description="RFxchange automatically ended the inactive, expired, or revoked session. Sign in again to restore the preserved Exchange destination after authorization checks."><div className={workflow.actions}><Link className={workflow.primary} href={withAuthEntryContext("/login", context)}>Sign in again</Link><Link className={workflow.secondary} href="/">Return to RFxchange</Link></div></LoginWorkflowFrame>; }
