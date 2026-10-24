import type { Metadata } from "next";
import { PageHeading } from "@/components/page-heading";
import { PriceHistory } from "@/components/price-history";
import { TenderTabs } from "@/components/tender-tabs";
import { getDb } from "@/db/client";
import { requireUser } from "@/lib/auth/current-user";
import { businessToday } from "@/lib/business-date";
import { listBidRows } from "@/server/services/tender-prices";

export const metadata: Metadata = { title: "Tender price history" };

export default async function TenderPricesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser("tender");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
  const rows = await listBidRows(getDb(), user.companyId);

  return (
    <div className="space-y-5">
      <PageHeading
        eyebrow={`${user.companyName} · Tenders`}
        title="Price history"
        sub="What the authorities paid in past tenders, item by item, and how our own bids fared. Built from the tender results you import. Where the data is thin, the page says so."
      />
      <TenderTabs current="prices" />
      <PriceHistory
        rows={rows}
        asOf={businessToday()}
        basePath="/tenders/prices"
        params={{ authority: one(sp.authority), area: one(sp.area), q: one(sp.q), item: one(sp.item) }}
        importHref={user.role === "owner" ? "/imports/tenders" : null}
        downloads={{ template: "/tenders/prices/download?file=template", sample: "/tenders/prices/download?file=sample" }}
      />
    </div>
  );
}
