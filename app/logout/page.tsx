import { LoginWorkflowFrame } from "@/components/identity/LoginWorkflowFrame";
import { SignOutPanel } from "@/components/identity/SignOutPanel";

export default function LogoutPage() { return <LoginWorkflowFrame nodeId="manual-logout" title="Sign out of RFxchange" description="End the current authenticated session and return to the Identity shell."><SignOutPanel /></LoginWorkflowFrame>; }
