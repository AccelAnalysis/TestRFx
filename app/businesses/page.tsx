import { PublicInfoPage } from "@/components/marketing/public-info-page";
import { publicPageDefinitions } from "@/lib/marketing/navigation";

export default function BusinessesPage() {
  return <PublicInfoPage definition={publicPageDefinitions.businesses} />;
}
