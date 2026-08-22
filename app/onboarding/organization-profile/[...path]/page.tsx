import { notFound } from "next/navigation";
import { OrganizationMediaProfilePage } from "@/components/onboarding/organization-media-profile-page";
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

  if (path.length === 2 && path[0] === "organization-details" && path[1] === "logo-branding") {
    return <OrganizationMediaProfilePage />;
  }

  return <OrganizationProfileForm initialContext={{ claimMode: "selected" }} activePath={path} />;
}
