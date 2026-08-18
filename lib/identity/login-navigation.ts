export type LoginWorkflowNodeId = "login" | "email-entry" | "email-found" | "email-not-found" | "register-choice" | "register" | "marketing-exit" | "send-sign-in-link" | "check-email" | "magic-link" | "link-valid" | "link-expired" | "resend-link" | "authenticate" | "additional-verification" | "mfa" | "verify-code" | "successful-login" | "exchange" | "invalid-link" | "rate-limited" | "restricted-account" | "session" | "active-session" | "remembered-device" | "session-timeout" | "manual-logout" | "support";
export type LoginWorkflowNode = { id: LoginWorkflowNodeId; label: string; parentId?: LoginWorkflowNodeId; route?: string; children: LoginWorkflowNodeId[] };
const node = (id: LoginWorkflowNodeId, label: string, parentId: LoginWorkflowNodeId | undefined, children: LoginWorkflowNodeId[] = [], route?: string): LoginWorkflowNode => ({ id, label, parentId, children, route });
export const loginWorkflow: Record<LoginWorkflowNodeId, LoginWorkflowNode> = {
  login: node("login", "Login", undefined, ["email-entry", "session", "support"], "/login"),
  "email-entry": node("email-entry", "Enter email", "login", ["email-found", "email-not-found"], "/login"),
  "email-found": node("email-found", "Email found", "email-entry", ["send-sign-in-link"]),
  "email-not-found": node("email-not-found", "Email not found", "email-entry", ["register-choice"], "/login/not-found"),
  "register-choice": node("register-choice", "Choose whether to register", "email-not-found", ["register", "marketing-exit"]),
  register: node("register", "Create account", "register-choice", [], "/register"),
  "marketing-exit": node("marketing-exit", "Return to marketing", "register-choice", [], "/"),
  "send-sign-in-link": node("send-sign-in-link", "Send sign-in link", "email-found", ["check-email"]),
  "check-email": node("check-email", "Check email", "send-sign-in-link", ["magic-link"], "/login/check-email"),
  "magic-link": node("magic-link", "Open magic link", "check-email", ["link-valid", "link-expired", "invalid-link"]),
  "link-valid": node("link-valid", "Link valid", "magic-link", ["authenticate"]),
  "link-expired": node("link-expired", "Link expired", "magic-link", ["resend-link"], "/login/link-expired"),
  "resend-link": node("resend-link", "Request new link", "link-expired", ["check-email"], "/login/check-email"),
  authenticate: node("authenticate", "Authenticate", "link-valid", ["additional-verification", "successful-login"], "/login/complete"),
  "additional-verification": node("additional-verification", "Additional verification required", "authenticate", ["mfa"]),
  mfa: node("mfa", "MFA / 2FA", "additional-verification", ["verify-code"], "/login/complete"),
  "verify-code": node("verify-code", "Verify code", "mfa", ["successful-login"], "/login/complete"),
  "successful-login": node("successful-login", "Successful login", "authenticate", ["exchange"]),
  exchange: node("exchange", "Enter RFxchange", "successful-login", [], "/exchange"),
  "invalid-link": node("invalid-link", "Invalid or tampered link", "magic-link", ["resend-link", "support"], "/login/link-invalid"),
  "rate-limited": node("rate-limited", "Too many attempts", "email-entry", ["support"], "/login/rate-limited"),
  "restricted-account": node("restricted-account", "Account deactivated or suspended", "email-entry", ["support"], "/login/restricted"),
  session: node("session", "Session states", "login", ["active-session", "remembered-device", "session-timeout", "manual-logout"]),
  "active-session": node("active-session", "Active session", "session", ["exchange"]),
  "remembered-device": node("remembered-device", "Remembered device", "session", ["active-session"]),
  "session-timeout": node("session-timeout", "Session timeout", "session", ["email-entry"], "/login/session-expired"),
  "manual-logout": node("manual-logout", "Manual logout", "session", ["email-entry"], "/logout"),
  support: node("support", "Contact support", "login", [], "/login/support"),
};
export function loginWorkflowAncestors(id: LoginWorkflowNodeId) { const result: LoginWorkflowNode[] = []; let current: LoginWorkflowNode | undefined = loginWorkflow[id]; while (current) { result.unshift(current); current = current.parentId ? loginWorkflow[current.parentId] : undefined; } return result; }
