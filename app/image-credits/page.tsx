import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "Image Credits | The RFxchange",
  description: "Public photography provenance and evidence-use rules for The RFxchange.",
};

export default function ImageCreditsPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES["image-credits"]} />;
}
