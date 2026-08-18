import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const root = process.cwd();
const target = join(root, "app/onboarding/detail/[subject]/[...path]/page.tsx");
await mkdir(dirname(target), { recursive: true });
await writeFile(
  target,
  `import { notFound } from "next/navigation";
import { OnboardingDetailSurface } from "@/components/onboarding/OnboardingDetailSurface";
import {
  getOnboardingDetailDefinition,
  getOnboardingDetailNode,
  isOnboardingDetailSubject,
  listOnboardingStaticDetailPaths,
} from "@/lib/onboarding/detail-surface";

export function generateStaticParams() {
  return listOnboardingStaticDetailPaths();
}

export default async function NestedOnboardingDetailPage({ params }: { params: Promise<{ subject: string; path: string[] }> }) {
  const { subject, path } = await params;
  if (!isOnboardingDetailSubject(subject)) notFound();
  const definition = getOnboardingDetailDefinition(subject);
  const active = getOnboardingDetailNode(subject, path);
  if (!definition || !active) notFound();
  return <OnboardingDetailSurface definition={definition} activePath={path} returnHref="/onboarding" />;
}
`,
  "utf8",
);

console.log("Prepared static nested onboarding Detail Surface routes.");
