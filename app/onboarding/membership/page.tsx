import type { Metadata } from "next";
import { MembershipSelectionClient } from "@/components/onboarding/membership-selection-client";
import { formatUsdCents, foundingMembership } from "@/lib/membership/catalog";
import { normalizeMembershipSelection } from "@/lib/membership/contracts";

export const metadata: Metadata = {
  title: "Participation & Membership | RFxchange",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function MembershipSelectionPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const selection = normalizeMembershipSelection(query.membership);
  const requestedPlan = selection === "founding" ? "founding" : "free";

  return (
    <MembershipSelectionClient
      foundingName={foundingMembership.name}
      foundingPrice={formatUsdCents(foundingMembership.price.cents)}
      foundingCapacity={foundingMembership.capacity.limit}
      requestedPlan={requestedPlan}
    />
  );
}
