import { notFound } from "next/navigation";
import { GeographyWorkflow } from "../../geography-workflow";
import {
  geographyNode,
  geographyRouteParams,
  isGeographyRoute,
  type GeographyStage,
} from "@/lib/onboarding/geography";

export function generateStaticParams() {
  return geographyRouteParams;
}

export default async function GeographyTaskPage({
  params,
}: {
  params: Promise<{ stage: string; task?: string[] }>;
}) {
  const { stage, task } = await params;
  const node = geographyNode(stage);
  if (!node) notFound();
  const taskName = task?.[0] ?? node.children[0]?.id;
  if (!taskName || !isGeographyRoute(stage, taskName)) notFound();

  return <GeographyWorkflow initialStage={stage as GeographyStage} initialTask={taskName} />;
}
