const TABS = [
  { key: "imports", label: "Import files", href: "/imports", ownerOnly: true },
  { key: "weekly", label: "Weekly update", href: "/weekly", ownerOnly: false },
] as const;

/**
 * The two screens of the "Alpha ERP data" group. Importing is owner-only; the weekly update is open to everyone who
 * can sign in, so other users see just the one tab.
 */
export function DataTabs({ current, owner }: { current: (typeof TABS)[number]["key"]; owner: boolean }) {
  const tabs = TABS.filter((t) => owner || !t.ownerOnly);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Alpha ERP data" className="mb-4 flex gap-2 text-sm">
      {tabs.map((t) => (
        <a
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? "page" : undefined}
          className={`rounded-md border px-3 py-2 ${t.key === current ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`}
        >
          {t.label}
        </a>
      ))}
    </nav>
  );
}
