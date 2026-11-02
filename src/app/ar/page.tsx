import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { landingAr } from "@/lib/landing/copy";

export const metadata: Metadata = {
  title: { absolute: landingAr.meta.title },
  description: landingAr.meta.description,
};

/** The Arabic front page. The app behind it is English; the Arabic copy has not had a native review. */
export default function HomeAr() {
  return <LandingPage locale="ar" />;
}
