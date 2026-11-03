import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { landingAr } from "@/lib/landing/copy";

export const metadata: Metadata = {
  title: { absolute: landingAr.meta.title },
  description: landingAr.meta.description,
};

type Search = Promise<Record<string, string | string[] | undefined>>;

async function FrontPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return <LandingPage locale="ar" home={sp.home === "1"} />;
}

/** The Arabic front page. The app behind it is English; the Arabic copy has not had a native review. */
export default function HomeAr({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<LandingPage locale="ar" />}>
      <FrontPage searchParams={searchParams} />
    </Suspense>
  );
}
