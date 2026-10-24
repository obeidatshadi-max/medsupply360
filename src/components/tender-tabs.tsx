const TABS = [
  { key: "list", label: "Tenders", live: "/tenders", sample: "/sample/tenders" },
  { key: "prices", label: "Price history", live: "/tenders/prices", sample: "/sample/tender-prices" },
] as const;

/** The two screens of the tender section: the tenders we are working on, and what the authorities paid in the past. */
export function TenderTabs({ current, sample = false }: { current: (typeof TABS)[number]["key"]; sample?: boolean }) {
  return (
    <nav aria-label="Tender section" className="mb-4 flex gap-2 text-sm">
      {TABS.map((t) => (
        <a
          key={t.key}
          href={sample ? t.sample : t.live}
          aria-current={t.key === current ? "page" : undefined}
          className={`rounded-md border px-3 py-2 ${t.key === current ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
