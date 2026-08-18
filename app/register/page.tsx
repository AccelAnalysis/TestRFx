import { RegistrationForm } from "@/components/identity/registration-form";
import { registrationContextFromSearchParams } from "@/lib/identity/registration";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const context = registrationContextFromSearchParams(params);

  return (
    <main className="identity-shell">
      <RegistrationForm initialContext={context} />
    </main>
  );
}
