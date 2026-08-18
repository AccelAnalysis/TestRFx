import { cookies } from "next/headers";
import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";
import { organizationProfileContextFromSearchParams } from "@/lib/onboarding/organization-profile";
import {
  ONBOARDING_PROGRESS_COOKIE,
  readOnboardingProgressCookie,
} from "@/lib/onboarding/progress-store";

export const dynamic = "force-dynamic";

export default async function OrganizationProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const queryContext = organizationProfileContextFromSearchParams(params);
  const cookieStore = await cookies();
  const progress = readOnboardingProgressCookie(cookieStore.get(ONBOARDING_PROGRESS_COOKIE)?.value);
  const context = {
    ...queryContext,
    organizationId: queryContext.organizationId ?? progress.context.organizationId,
    organizationName: queryContext.organizationName ?? progress.context.organizationName,
    geography: queryContext.geography ?? progress.context.geography,
  };

  return <OrganizationProfileForm initialContext={context} />;
}
