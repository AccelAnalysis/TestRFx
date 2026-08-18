import OrganizationSelectionClient from "./OrganizationSelectionClient";
import {
  organizationContextFromSearchParams,
  organizationStepFromSearchParams,
} from "@/lib/onboarding/organization";

export default async function OrganizationSelectionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = organizationContextFromSearchParams(params);
  const initialStep = organizationStepFromSearchParams(params, context);

  return <OrganizationSelectionClient initialContext={context} initialStep={initialStep} />;
}
