import type { Metadata } from "next";
import { PublicInfoPage } from "@/components/public/public-info-page";
import { PUBLIC_INFO_PAGES } from "@/lib/public/pages";

export const metadata: Metadata = {
  title: "Terms of Service | RFxchange",
  description: "Current RFxchange Terms of Service.",
};

export default function TermsPage() {
  return <PublicInfoPage page={PUBLIC_INFO_PAGES.terms} />;
}
