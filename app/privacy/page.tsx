import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "Privacy Policy | RFxchange",
  description: "Current RFxchange Privacy Policy.",
};

export default function PrivacyPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES.privacy} />;
}
