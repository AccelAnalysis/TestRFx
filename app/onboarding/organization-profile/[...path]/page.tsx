import { notFound } from "next/navigation";
import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";
import {
  ORGANIZATION_PROFILE_STATIC_PATHS,
  resolveOrganizationProfilePath,
} from "@/lib/onboarding/organization-profile-navigation";

export function generateStaticParams() {
  return ORGANIZATION_PROFILE_STATIC_PATHS.map((path) => ({ path }));
}

export default async function OrganizationProfilePathPage({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const { path } = await params;
  if (!resolveOrganizationProfilePath(path)) notFound();
  return <OrganizationProfileForm initialContext={{ claimMode: "selected" }} activePath={path} />;
}
