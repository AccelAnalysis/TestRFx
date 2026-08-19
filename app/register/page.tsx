import { RegistrationWorkflow } from "@/components/identity/registration-workflow";
import { registrationContextFromSearchParams } from "@/lib/identity/registration";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = registrationContextFromSearchParams(params);

  return (
    <main className="identity-shell">
      <RegistrationWorkflow
        initialPath={["create-account", "name"]}
        initialContext={context}
        initialRegistrationId={first(params.registration)}
      />
    </main>
  );
}
