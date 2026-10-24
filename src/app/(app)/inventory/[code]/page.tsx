import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssignActionLink } from "@/components/assign-action-link";
import { PageHeading } from "@/components/page-heading";
import { stockCoverDays } from "@/core/calc";
import { EXPIRY_WINDOW_DAYS } from "@/core/stock-risk";
import { requireUser } from "@/lib/auth/current-user";
import { dayText, jod } from "@/lib/format";
import { companyStockRisk } from "@/lib/stock-risk";

export const metadata: Metadata = { title: "Product stock" };

const n = (v: number) => v.toLocaleString("en-US");

export default async function ProductStockPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  if (user.guest) return <PageHeading eyebrow="Inventory & supply" title="Product stock" sub="Please sign in with a company account to see this page." />;
  const code = decodeURIComponent((await params).code);
  const r = await companyStockRisk(user.companyId, null, code);
  if (!r || r.batches.length === 0) notFound();

  const first = r.batches[0]!;
  const quantity = r.batches.reduce((s, b) => s + b.quantity, 0);
  const costed = r.batches.filter((b) => b.unitCost !== null);
  const value = costed.reduce((s, b) => s + b.quantity * (b.unitCost ?? 0), 0);
  const daily = r.dailyIssues.get(code) ?? 0;
  const cover = stockCoverDays(quantity, daily);

  const tiles = [
    { label: "Stock value at cost", value: jod(Math.round(value)), note: costed.length < r.batches.length ? `${r.batches.length - costed.length} batch(es) with no unit cost are left out` : `Owned stock, stock file of ${r.asOf}` },
    { label: "Units on hand", value: n(quantity), note: `${r.batches.length} batch${r.batches.length === 1 ? "" : "es"}` },
    { label: "Days of stock left", value: typeof cover === "number" ? `${n(Math.round(cover))} d` : "No recent use", note: `At the average sent to customers in the ${r.windowDays} days before the stock file` },
    { label: "Possible loss from expiry (estimate)", value: jod(Math.round(r.expiryLossEstimate)), note: `Stock we may not sell before it expires, in the next ${EXPIRY_WINDOW_DAYS} days` },
  ];

  return (
    <div className="space-y-6">
      <PageHeading eyebrow={`${user.companyName} · Inventory & supply · ${code}`} title={first.productName} sub={`${first.line}. Owned stock only, from the stock file of ${dayText(r.asOf)}.`} />
      <div className="grid grid-cols-2 gap-[10px] md:gap-[14px] min-[1000px]:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} data-figure className="rounded-[9px] border border-line bg-white p-[15px] md:p-[21px]">
            <p className="text-[11px] text-muted md:text-xs">{s.label}</p>
            <p className="my-2 text-2xl tracking-[-0.9px] md:text-[29px]">{s.value}</p>
            <p className="text-[10px] text-muted md:text-[11px]">{s.note}</p>
          </div>
        ))}
      </div>

      <section aria-label="Batches">
        <h2 className="text-sm font-semibold">Batches</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Batch</th>
                <th className="px-3 py-2 font-medium">Expires</th>
                <th className="px-3 py-2 text-right font-medium">Quantity</th>
                <th className="px-3 py-2 text-right font-medium">Unit cost</th>
                <th className="px-3 py-2 text-right font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {[...r.batches]
                .sort((a, b) => (a.expiryDate ?? "9999").localeCompare(b.expiryDate ?? "9999"))
                .map((b) => {
                  const risk = r.expiryRisks.find((x) => x.batch === b.batch);
                  return (
                    <tr key={b.batch} className="border-t border-line">
                      <td className="px-3 py-2">{b.batch || "—"}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {b.expiryDate ? dayText(b.expiryDate) : <span className="text-muted">Not recorded</span>}
                        {risk ? <span className="ml-1 text-xs text-bad">{risk.expired ? "expired" : `${risk.daysLeft} d left`}</span> : null}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{n(b.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.unitCost === null ? "—" : jod(b.unitCost)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.unitCost === null ? "—" : jod(Math.round(b.quantity * b.unitCost))}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">Stock value is tied-up capital, not itself a loss. Validate lot quantities, demand, supplier lead time and transfer options.</p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <AssignActionLink
          role={user.role}
          title={`Review stock: ${first.productName}`}
          evidence={`${code} · ${n(quantity)} units, ${jod(Math.round(value))} at cost${r.expiryLossEstimate > 0 ? `, about ${jod(Math.round(r.expiryLossEstimate))} possible expiry loss` : ""}`}
          responsible="Operations manager"
          label="Assign stock review →"
        />
        <Link href="/inventory" className="text-sm text-brand underline underline-offset-2">
          Back to Inventory & supply
        </Link>
      </div>
    </div>
  );
}
