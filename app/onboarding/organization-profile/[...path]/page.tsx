import { notFound } from "next/navigation";
import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";
import { organizationProfileContextFromSearchParams } from "@/lib/onboarding/organization-profile";
import {
  ORGANIZATION_PROFILE_STATIC_PATHS,
  resolveOrganizationProfilePath,
} from "@/lib/onboarding/organization-profile-navigation";

export function generateStaticParams() {
  return ORGANIZATION_PROFILE_STATIC_PATHS.map((path) => ({ path }));
}

export default async function OrganizationProfilePathPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  if (!resolveOrganizationProfilePath(path)) notFound();
  const context = organizationProfileContextFromSearchParams(query);
  return <OrganizationProfileForm initialContext={context} activePath={path} />;
}
