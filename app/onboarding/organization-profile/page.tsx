import { OrganizationProfileForm } from "@/components/onboarding/organization-profile-form";

export default function OrganizationProfilePage() {
  return <OrganizationProfileForm initialContext={{ claimMode: "selected" }} activePath={[]} />;
}
