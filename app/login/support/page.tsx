import Link from "next/link";
import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import workflow from "@/components/identity/login-workflow.module.css";

export default function LoginSupportPage() {
  const supportEmail = process.env.RFX_SUPPORT_EMAIL;
  return <LoginWorkflowFrame nodeId="support" title="Login support" description="Use the configured RFxchange support channel for account restrictions, repeated verification failures, or authentication delivery problems."><div className={workflow.actions}>{supportEmail ? <a className={workflow.primary} href={`mailto:${supportEmail}`}>Email RFxchange support</a> : <p className={workflow.note}>No support email is configured for this deployment. Set RFX_SUPPORT_EMAIL in the production environment rather than presenting a fictional support destination.</p>}<Link className={workflow.secondary} href="/login">Return to Login</Link></div></LoginWorkflowFrame>;
}
