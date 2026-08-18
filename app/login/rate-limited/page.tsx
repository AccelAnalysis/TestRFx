import Link from "next/link";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import workflow from "@/components/identity/login-workflow.module.css";

export default function RateLimitedPage() { return <LoginWorkflowFrame nodeId="rate-limited" title="Too many sign-in attempts" description="RFxchange temporarily stopped additional sign-in challenges for this identity/network combination. This protects the authentication boundary from abuse."><div className={workflow.actions}><Link className={workflow.secondary} href="/login">Return to Login later</Link><Link className={workflow.primary} href="/login/support">Contact support</Link></div></LoginWorkflowFrame>; }
