const TABS = [
  { key: "imports", label: "Data channels", href: "/imports", needs: "owner" },
  { key: "history", label: "Update history", href: "/history", needs: "history" },
] as const;

/**
 * The screens of the "Data" group. Loading data is owner-only; the update history is for the owner and administrators. A person who may open only one sees no tab strip.
 */
export function DataTabs({ current, owner, history }: { current: (typeof TABS)[number]["key"]; owner: boolean; history: boolean }) {
  const allowed = { owner, history };
  const tabs = TABS.filter((t) => allowed[t.needs]);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Data" className="mb-4 flex flex-wrap gap-2 text-sm">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border px-4 py-2 ${t.key === current ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
