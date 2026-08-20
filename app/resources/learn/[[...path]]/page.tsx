import { PublicResourceCollectionPage } from "@/components/public-resources/resource-collection-page";
import { publicResourceParamsForSection } from "@/lib/public-content/navigation";

const sectionHref = "/resources/learn";

export function generateStaticParams() {
  return publicResourceParamsForSection(sectionHref);
}

export default async function LearnResourcesPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  return <PublicResourceCollectionPage href={[sectionHref, ...path].join("/")} />;
}
