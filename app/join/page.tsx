import { redirect } from "next/navigation";
import {
  AuthEntrySearchParams,
  buildIdentityHref,
  parseAuthEntryContext,
} from "@/lib/acquisition/auth-entry";

export default async function JoinEntryPage({
  searchParams,
}: {
  searchParams: Promise<AuthEntrySearchParams>;
}) {
  const context = parseAuthEntryContext(await searchParams);
  redirect(buildIdentityHref("register", context));
}
