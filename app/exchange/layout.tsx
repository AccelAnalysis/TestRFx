import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionActivityGuard } from "@/components/identity/SessionActivityGuard";
import { resolvePostLoginDestination } from "@/lib/identity/readiness";
import { SESSION_COOKIE_NAME, verifyAuthenticatedSession } from "@/lib/identity/session";

export default async function ExchangeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  if (process.env.RFXCHANGE_PAGES_PREVIEW === "1") return <>{children}</>;
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) redirect("/login?returnTo=/exchange");
  try {
    const identity = await verifyAuthenticatedSession(sessionCookie, false);
    const destination = resolvePostLoginDestination(identity.readiness, "/exchange");
    if (!destination.startsWith("/exchange")) redirect(destination);
  } catch { redirect("/login/session-expired?returnTo=/exchange"); }
  return <SessionActivityGuard>{children}</SessionActivityGuard>;
}
