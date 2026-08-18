import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "Platform Rules | RFxchange",
  description: "Current RFxchange Platform Rules and conduct requirements.",
};

export default function PlatformRulesPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES["platform-rules"]} />;
}
