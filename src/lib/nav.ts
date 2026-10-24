import { canAccess, canSeeSalesForce, type Role } from "@/core/permissions";

/**
 * Sidebar navigation, in the demo's order and wording, except that the weekly update lives under "Alpha ERP data" and the
 * unbuilt "Compare versions" is left out until it has a home inside Settings. An item without an `href` is a screen the
 * demo shows that the app has not built yet: it is listed, greyed out and marked "Soon", never linked to a page that
 * does not exist. What each role sees comes from `canAccess` in core/permissions.
 */
export type NavItem = {
  label: string;
  icon: string;
  href?: string;
  /** Path prefixes that make this item the current one. */
  match?: string[];
  /** Path prefixes that belong to a different item even though they start with one of `match`. */
  exclude?: string[];
  /** Small note shown instead of "Soon", e.g. "Owner". */
  note?: string;
};

export function navItems({ guest, role }: { guest: boolean; role: Role }): { main: NavItem[]; explore: NavItem[] } {
  const owner = role === "owner";
  const tender: NavItem = { label: "Tenders", icon: "▣", href: "/tenders", match: ["/tenders"] };
  // Department users (tender, finance) get the tender section and nothing else.
  if (!canAccess(role, "business")) return { main: [tender], explore: [] };
  const main: NavItem[] = [
    { label: "Owner overview", icon: "◫", href: "/dashboard", match: ["/dashboard"] },
    { label: "Products & suppliers", icon: "▦", href: "/portfolio", match: ["/portfolio"] },
    { label: "Sales & accounts", icon: "↗", href: "/accounts/all", match: ["/accounts"] },
    ...(canSeeSalesForce(role) && !guest ? [{ label: "Sales force", icon: "☺", href: "/sales-force", match: ["/sales-force"] } satisfies NavItem] : []),
    { label: "Inventory & supply", icon: "▦", href: "/inventory", match: ["/inventory"] },
    { label: "Finance & profitability", icon: "◉", href: "/finance", match: ["/finance"] },
    { label: "Management actions", icon: "✓", href: "/opportunities", match: ["/opportunities"] },
    // One data group: the owner lands on Import files, everyone else on the Weekly update (see DataTabs).
    owner && !guest
      ? { label: "Alpha ERP data", icon: "⇄", href: "/imports", match: ["/imports", "/weekly", "/history"] }
      : { label: "Alpha ERP data", icon: "⇄", href: "/weekly", match: ["/weekly", "/history"] },
  ];
  if (canAccess(role, "tender") && !guest) main.push(tender);
  if (canAccess(role, "settings") && !guest) main.push({ label: "Settings", icon: "⚙", href: "/settings", match: ["/settings"] });
  // Sample screens use made-up numbers: everyone with business access may open them, guests included.
  const explore: NavItem[] = [
    ...(guest ? [] : [{ label: "Sample data", icon: "◇", href: "/sample", match: ["/sample"], exclude: ["/sample/tenders", "/sample/tender-prices"] }]),
    { label: "Sample tenders", icon: "◇", href: "/sample/tenders", match: ["/sample/tenders", "/sample/tender-prices"] },
  ];
  return { main, explore };
}

/** The Accounts page filtered to one customer, for jumping there from a name on another page (the search matches the code). */
export const accountHref = (code: string) => `/accounts/all?q=${encodeURIComponent(code)}`;

/** Breadcrumb text for the current path. */
export function isCurrentItem(pathname: string, item: NavItem): boolean {
  const under = (m: string) => pathname === m || pathname.startsWith(`${m}/`);
  return (item.match?.some(under) ?? false) && !item.exclude?.some(under);
}

export function crumbFor(pathname: string, items: NavItem[]): string {
  const hit = items.find((i) => isCurrentItem(pathname, i));
  return hit?.label ?? "Overview";
}
