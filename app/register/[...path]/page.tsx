import { notFound } from "next/navigation";
import { RegistrationWorkflow } from "@/components/identity/registration-workflow";
import { registrationContextFromSearchParams } from "@/lib/identity/registration";
import {
  findRegistrationWorkflowNode,
  registrationWorkflowPaths,
} from "@/lib/identity/registration-navigation";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function generateStaticParams() {
  return registrationWorkflowPaths.map((path) => ({ path }));
}

export default async function RegistrationWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, query] = await Promise.all([params, searchParams]);
  if (!findRegistrationWorkflowNode(path)) notFound();

  return (
    <main className="identity-shell">
      <RegistrationWorkflow
        initialPath={path}
        initialContext={registrationContextFromSearchParams(query)}
        initialRegistrationId={first(query.registration)}
      />
    </main>
  );
}
