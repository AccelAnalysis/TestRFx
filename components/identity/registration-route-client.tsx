"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { RegistrationWorkflow } from "@/components/identity/registration-workflow";
import { registrationContextFromUrlSearchParams } from "@/lib/identity/registration";

export function RegistrationRouteClient({ initialPath }: { initialPath: string[] }) {
  const searchParams = useSearchParams();
  const context = useMemo(
    () => registrationContextFromUrlSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const registrationId = searchParams.get("registration") ?? undefined;

  return (
    <RegistrationWorkflow
      initialPath={initialPath}
      initialContext={context}
      initialRegistrationId={registrationId}
    />
  );
}
