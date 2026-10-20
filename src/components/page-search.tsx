"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { applySearch, type SearchResult } from "@/core/page-search";

/**
 * "Search current view" in the top bar, as in the demo: narrows the rows and cards of the screen being read. It searches
 * only what the page already shows, clears itself when the person opens another screen, and re-applies after the page
 * refreshes (for example after a save).
 */
export function PageSearch() {
  const pathname = usePathname();
  const [state, setState] = useState({ path: pathname, query: "" });
  const [result, setResult] = useState<SearchResult | null>(null);
  // A different screen starts with an empty box.
  const query = state.path === pathname ? state.query : "";

  useEffect(() => {
    const root = document.querySelector("main");
    if (!root) return;
    const run = () => {
      const found = applySearch(root, query);
      setResult(query.trim() === "" ? null : found);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [query, pathname]);

  return (
    <div className="flex items-center gap-2">
      <input
        type="search"
        value={query}
        onChange={(e) => setState({ path: pathname, query: e.target.value })}
        placeholder="Search current view…"
        aria-label="Search current view"
        className="w-[clamp(110px,28vw,230px)] rounded-[7px] border border-line bg-white px-3 py-1.5 text-sm"
      />
      {result ? (
        <span role="status" className="hidden whitespace-nowrap text-xs text-muted md:inline">
          {result.shown === 0 ? "Nothing matches" : `${result.shown} of ${result.total} shown`}
        </span>
      ) : null}
    </div>
  );
}
