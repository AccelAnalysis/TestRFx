import { PublicInfoPage } from "@/components/marketing/public-info-page";
import { publicPageDefinitions } from "@/lib/marketing/navigation";

export default function PrivacyPage() {
  return <PublicInfoPage definition={publicPageDefinitions.privacy} />;
}
