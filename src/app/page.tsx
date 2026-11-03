import { Suspense } from "react";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { landingEn } from "@/lib/landing/copy";

export const metadata: Metadata = {
  title: { absolute: landingEn.meta.title },
  description: landingEn.meta.description,
};

type Search = Promise<Record<string, string | string[] | undefined>>;

async function FrontPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return <LandingPage locale="en" home={sp.home === "1"} />;
}

/**
 * Public front page. Signed-in visitors are sent straight to the dashboard (proxy.ts), except when they ask for it with the Home
 * button (`/?home=1`); then the buttons take them back to the workspace instead of to the sign-in page. The plain page is the
 * static shell; only the `home` flag is read per request.
 */
export default function Home({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<LandingPage locale="en" />}>
      <FrontPage searchParams={searchParams} />
    </Suspense>
  );
}
