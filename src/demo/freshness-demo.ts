/**
 * The promotional demo's data-freshness notice. It runs the app's own freshness rules (src/core/freshness.ts) on made-up
 * file dates, so the overview shows the same warning wording a real owner would see when imports fall behind.
 */
import { assessFreshness, type Freshness } from "@/core/freshness";
import { dayText } from "@/lib/format";
import { DEMO_AS_OF } from "./dataset";

/** Made-up "newest date in each imported file", chosen so the demo shows one aging and one stale file. */
export const DEMO_FILE_DATES = {
  latestInvoice: "2026-09-30",
  latestReceipt: "2026-09-24",
  openInvoicesAsOf: "2026-09-30",
  stockAsOf: "2026-08-31",
} as const;

export const demoFreshness = (): Freshness => assessFreshness({ today: DEMO_AS_OF, ...DEMO_FILE_DATES });

const daysAgo = (n: number) => (n === 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`);

/** The notice, or an empty string when everything is current (the app stays quiet then too). One slim line, so the figure cards stay near the top. */
export function freshnessHtml(): string {
  const f = demoFreshness();
  if (f.level === "current") return "";
  const stale = f.level === "stale";
  const late = f.items.filter((i) => i.asOf && i.level !== "current");
  return (
    `<section class="panel" role="status" aria-label="Data freshness" style="border-left:4px solid ${stale ? "var(--red)" : "var(--gold)"};padding:10px 16px;margin-bottom:14px">` +
    `<p style="margin:0"><b style="color:${stale ? "var(--red)" : "inherit"}">${stale ? "!! The data is out of date." : "! The data is getting old."}</b> ` +
    `${late.map((i) => `${i.label}: up to ${dayText(i.asOf as string)} (${daysAgo(i.daysOld as number)})`).join(" · ")}. ` +
    `<span class="mini">The owner sees an "Import newer files" button here.</span></p>` +
    `<details><summary class="mini" style="cursor:pointer">What this means</summary><p class="mini" style="margin:4px 0 0">${
      stale
        ? "Some figures below may look worse than reality, because newer invoices and payments are not loaded yet."
        : "Newer invoices or payments may not be loaded yet, so check the dates before you act on a figure."
    } These are sample file dates.</p></details></section>`
  );
}
