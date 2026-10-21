import type { Freshness } from "@/core/freshness";
import { dayText } from "@/lib/format";

const daysAgo = (n: number) => (n === 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`);

/**
 * Says how old the imported data is. Shown only when something is aging or stale, so a healthy overview stays quiet.
 * It is one slim line above the figure cards so the cards stay near the top of the screen; the longer explanation sits
 * behind "What this means". The wording is plain on purpose: it names each file, its newest date and how long ago that was.
 */
export function FreshnessBanner({ freshness, canImport }: { freshness: Freshness; canImport: boolean }) {
  if (freshness.level === "current") return null;
  const stale = freshness.level === "stale";
  const late = freshness.items.filter((i) => i.asOf && i.level !== "current");
  return (
    <section
      role="status"
      aria-label="Data freshness"
      className={`mb-4 rounded-[10px] border border-l-4 px-4 py-2.5 text-sm ${stale ? "border-bad border-l-bad bg-bad-soft" : "border-warn border-l-warn bg-warn-soft"}`}
    >
      <p>
        <span className={`font-semibold ${stale ? "text-bad" : "text-warn"}`}>{stale ? "!! The data is out of date." : "! The data is getting old."}</span>{" "}
        {late.map((i) => `${i.label}: up to ${dayText(i.asOf as string)} (${daysAgo(i.daysOld as number)})`).join(" · ")}.{" "}
        {canImport ? (
          <a href="/imports" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 md:min-h-0">
            Import newer files
          </a>
        ) : (
          <span className="text-xs text-muted">Ask the account owner to import newer files.</span>
        )}
      </p>
      <details className="mt-1 text-xs">
        <summary className="flex min-h-11 cursor-pointer items-center text-muted md:min-h-0">What this means</summary>
        <p className="mt-1">
          {stale
            ? "Some figures below may look worse than reality, because newer invoices and payments are not loaded yet."
            : "Newer invoices or payments may not be loaded yet, so check the dates before you act on a figure."}
        </p>
      </details>
    </section>
  );
}
