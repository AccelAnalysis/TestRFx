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

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

  if (path.length === 2 && path[0] === "organization-details" && path[1] === "logo-branding") {
    return (
      <OrganizationMediaProfilePage
        organizationId={one(query.organization)}
        organizationName={one(query.name)}
        returnTo={one(query.returnTo)}
      />
    );
  }

  return <OrganizationProfileForm initialContext={{ claimMode: "selected" }} activePath={path} />;
}
