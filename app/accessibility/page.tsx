import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "Accessibility | The RFxchange",
  description: "Accessibility principles and feedback path for The RFxchange public and account surfaces.",
};

export default function AccessibilityPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES.accessibility} />;
}
