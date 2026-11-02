import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { landingEn } from "@/lib/landing/copy";

export const metadata: Metadata = {
  title: { absolute: landingEn.meta.title },
  description: landingEn.meta.description,
};

/** Public front page. Signed-in visitors never see it: the proxy sends them straight to the dashboard. */
export default function Home() {
  return <LandingPage locale="en" />;
}
