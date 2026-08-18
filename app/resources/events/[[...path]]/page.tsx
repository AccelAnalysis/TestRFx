import { PublicResourceCollectionPage } from "@/components/public-resources/resource-collection-page";
import { publicResourceParamsForSection } from "@/lib/public-content/navigation";

const sectionHref = "/resources/events";

export function generateStaticParams() {
  return publicResourceParamsForSection(sectionHref);
}

export default async function EventResourcesPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  return <PublicResourceCollectionPage href={[sectionHref, ...path].join("/")} />;
}
