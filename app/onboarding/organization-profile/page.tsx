import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";
import { organizationProfileContextFromSearchParams } from "@/lib/onboarding/organization-profile";

export default async function OrganizationProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = organizationProfileContextFromSearchParams(params);
  return <OrganizationProfileForm initialContext={context} activePath={[]} />;
}
