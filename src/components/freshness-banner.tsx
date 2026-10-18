import type { Freshness } from "@/core/freshness";
import { dayText } from "@/lib/format";

const daysAgo = (n: number) => (n === 0 ? "today" : n === 1 ? "1 day ago" : `${n} days ago`);

/**
 * Says how old the imported data is. Shown only when something is aging or stale, so a healthy overview stays quiet.
 * The wording is plain on purpose: it names each file, its newest date and how long ago that was.
 */
export function FreshnessBanner({ freshness, canImport }: { freshness: Freshness; canImport: boolean }) {
  if (freshness.level === "current") return null;
  const stale = freshness.level === "stale";
  const late = freshness.items.filter((i) => i.asOf && i.level !== "current");
  return (
    <section
      role="status"
      aria-label="Data freshness"
      className={`mb-4 rounded-[10px] border border-l-4 p-4 text-sm ${stale ? "border-bad border-l-bad bg-bad-soft" : "border-warn border-l-warn bg-warn-soft"}`}
    >
      <p className={`font-semibold ${stale ? "text-bad" : "text-warn"}`}>
        {stale ? "!! The data is out of date" : "! The data is getting old"}
      </p>
      <p className="mt-1">
        {stale
          ? "Some figures below may look worse than reality, because newer invoices and payments are not loaded yet."
          : "Newer invoices or payments may not be loaded yet, so check the dates before you act on a figure."}
      </p>
      <ul className="mt-2 space-y-1">
        {late.map((i) => (
          <li key={i.key}>
            <span className="font-semibold">{i.label}:</span> data goes up to {dayText(i.asOf as string)} ({daysAgo(i.daysOld as number)})
          </li>
        ))}
      </ul>
      {canImport ? (
        <a href="/imports" className="mt-3 inline-block rounded-[7px] border border-line bg-white px-3 py-1.5 text-xs font-semibold hover:border-brand">
          Import newer files
        </a>
      ) : (
        <p className="mt-2 text-xs text-muted">Ask the account owner to import newer files.</p>
      )}
    </section>
  );
}
