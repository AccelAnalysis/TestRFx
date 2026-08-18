import Link from "next/link";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import workflow from "@/components/identity/login-workflow.module.css";

export default function RestrictedAccountPage() { return <LoginWorkflowFrame nodeId="restricted-account" title="Account access is restricted" description="This account is deactivated, suspended, or otherwise restricted. RFxchange will not establish an Exchange session while the restriction is active."><div className={workflow.actions}><Link className={workflow.primary} href="/login/support">Contact support</Link><Link className={workflow.secondary} href="/">Return to RFxchange</Link></div></LoginWorkflowFrame>; }
