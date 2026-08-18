"use client";

import { RegistrationWorkflow } from "@/components/identity/registration-workflow";
import type { RegistrationEntryContext } from "@/lib/identity/registration";

/**
 * Compatibility projection used by the static Pages preview adapter.
 * Production routes use RegistrationWorkflow directly. No reference identity
 * adapter or simulated successful registration remains behind this component.
 */
export function RegistrationForm({ initialContext }: { initialContext: RegistrationEntryContext }) {
  return (
    <RegistrationWorkflow
      initialPath={["create-account", "name"]}
      initialContext={initialContext}
    />
  );
}
