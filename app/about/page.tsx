import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "About | The RFxchange",
  description: "Learn how The RFxchange is designed to make local business capability, opportunity, resources, and connections more visible and actionable.",
};

export default function AboutPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES.about} />;
}
