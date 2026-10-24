import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PriceHistory } from "@/components/price-history";
import { TenderTabs } from "@/components/tender-tabs";
import { requireUser } from "@/lib/auth/current-user";
import { DEMO_PRICES_AS_OF, demoBidRows } from "@/demo/tender-prices-demo";

export const metadata: Metadata = { title: "Sample price history" };

/** Made-up price history, shown the way the live page shows imported results. Open to guests and to every business user. */
export default async function SampleTenderPricesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow="Sample · Tenders"
        title="Price history"
        sub="Four years of made-up tender results from five authorities, each publishing in a different way. This is how the page looks once real results are imported."
      />
      <TenderTabs current="prices" sample />
      <PriceHistory
        rows={demoBidRows()}
        asOf={DEMO_PRICES_AS_OF}
        basePath="/sample/tender-prices"
        params={{ authority: one(sp.authority), area: one(sp.area), q: one(sp.q), item: one(sp.item) }}
        importHref={null}
        downloads={null}
        sample
      />
    </div>
  );
}
