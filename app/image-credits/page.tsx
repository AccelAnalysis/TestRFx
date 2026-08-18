import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export default function ImageCreditsPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES["image-credits"]} />;
}
