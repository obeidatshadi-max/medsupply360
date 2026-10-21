"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExportButton } from "@/components/export-button";
import { PageSearch } from "@/components/page-search";
import { crumbFor, isCurrentItem as isCurrent, type NavItem } from "@/lib/nav";


/**
 * The demo's layout: dark sidebar with the MEDSUPPLY360 mark and the customer's name, white top bar with a breadcrumb, then the freshness strip
 * and the page. Under 768 px the sidebar becomes a drawer opened from the menu button.
 */
export function AppFrame({
  main,
  explore,
  fullName,
  initials,
  companyName,
  banner,
  topRight,
  status,
  children,
}: {
  main: NavItem[];
  explore: NavItem[];
  fullName: string;
  initials: string;
  companyName: string;
  banner?: React.ReactNode;
  topRight: React.ReactNode;
  status: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const crumb = crumbFor(pathname, [...main, ...explore]);

  const renderItem = (item: NavItem) => {
    const base = "flex min-h-10 w-full items-center gap-3 rounded-[7px] px-[13px] py-[11px] text-left text-sm";
    if (!item.href) {
      return (
        <li key={item.label}>
          <span aria-disabled="true" className={`${base} cursor-default text-side-muted opacity-70`}>
            <span aria-hidden className="w-[18px] text-base opacity-80">
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            <span className="rounded bg-side-hover px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-side-ink">{item.note ?? "Soon"}</span>
          </span>
        </li>
      );
    }
    const current = isCurrent(pathname, item);
    return (
      <li key={item.label}>
        <Link
          href={item.href}
          aria-current={current ? "page" : undefined}
          onClick={() => setOpen(false)}
          className={`${base} ${current ? "bg-side-hover text-white" : "text-side-ink hover:bg-side-hover hover:text-white"}`}
        >
          <span aria-hidden className="w-[18px] text-base opacity-80">
            {item.icon}
          </span>
          {item.label}
        </Link>
      </li>
    );
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[195px_1fr] xl:grid-cols-[230px_1fr]">
      <aside
        id="sidebar"
        aria-label="Sidebar"
        className={`${open ? "fixed inset-y-0 left-0 z-20 flex w-[min(86vw,300px)] shadow-2xl" : "hidden"} h-dvh flex-col bg-side px-4 py-[27px] text-[#e9efeb] md:sticky md:top-0 md:z-auto md:flex md:w-auto md:shadow-none xl:px-[18px]`}
      >
        <div className="px-3 text-[25px] font-bold tracking-[-0.6px]">
          MEDSUPPLY<span className="text-gold-soft">360</span>
          <small className="mt-[5px] block text-[10px] font-normal uppercase tracking-[2px] text-[#a7bab2]">{companyName} · BUSINESS CONTROL TOWER</small>
        </div>
        <p className="mx-3 mb-2.5 mt-9 text-[10px] tracking-[1.8px] text-side-muted">YOUR BUSINESS</p>
        <nav aria-label="Main" className="min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-color:#455952_transparent] [scrollbar-width:thin]">
          <ul>{main.map(renderItem)}</ul>
          {explore.length > 0 ? (
            <>
              <p className="mx-3 mb-2.5 mt-7 text-[10px] tracking-[1.8px] text-side-muted">EXPLORE</p>
              <ul>{explore.map(renderItem)}</ul>
            </>
          ) : null}
        </nav>
        <div className="mt-auto border-t border-side-line px-3 pt-5 text-xs text-[#b4c5bc]">
          <div className="flex items-center">
            <span aria-hidden className="mr-[9px] inline-grid size-8 place-items-center rounded-full bg-avatar font-bold text-[#22342f]">
              {initials}
            </span>
            <b className="min-w-0 break-words">{fullName}</b>
          </div>
          <p className="mt-3">{companyName}</p>
        </div>
      </aside>
      {open ? <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-10 bg-[#142b2760] md:hidden" /> : null}

      <div className="min-w-0">
        {banner}
        <header className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3 md:px-8 md:py-[17px]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle navigation"
              aria-expanded={open}
              aria-controls="sidebar"
              onClick={() => setOpen((o) => !o)}
              className="min-h-11 min-w-11 rounded-[7px] border border-line bg-white px-3 py-2 text-sm md:hidden"
            >
              ☰
            </button>
            <p className="hidden text-xs text-muted md:block">
              {companyName} / <b className="text-ink">{crumb}</b>
            </p>
            <p className="text-sm font-semibold md:hidden">{crumb}</p>
          </div>
          <div className="flex items-center gap-2">
            <PageSearch />
            <ExportButton name={crumb} />
            <Link href="/how-it-works" className="hidden rounded-[7px] border border-line bg-white px-3 py-1.5 text-sm hover:border-brand hover:bg-[#f0f6f2] md:inline-block">
              How it works
            </Link>
            {topRight}
          </div>
        </header>
        {status}
        <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-[30px]">{children}</main>
      </div>
    </div>
  );
}
