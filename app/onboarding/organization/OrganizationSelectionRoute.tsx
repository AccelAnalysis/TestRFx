"use client";

import { useSearchParams } from "next/navigation";
import {
  organizationContextFromSearchParams,
  organizationStepFromSearchParams,
} from "@/lib/onboarding/organization";
import OrganizationSelectionClient from "./OrganizationSelectionClient";

export default function OrganizationSelectionRoute() {
  const searchParams = useSearchParams();
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  const context = organizationContextFromSearchParams(params);
  const initialStep = organizationStepFromSearchParams(params, context);

  return <OrganizationSelectionClient initialContext={context} initialStep={initialStep} />;
}
