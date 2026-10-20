/**
 * The top-bar search ("Search current view"): hides the rows and cards of the screen that do not contain what was typed,
 * as the demo does. The matching is pure so it is tested on its own; `applySearch` is the small DOM part.
 *
 * Every word typed must appear somewhere in the row, in any order, ignoring letter case and Arabic diacritics.
 * Nothing is searched on the server and nothing is stored: it only narrows what the page already shows.
 */

/** Lower-case, Arabic diacritics and tatweel removed, spaces collapsed. */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[ً-ٰٟـ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The words of a query; an empty query has none, and matches everything. */
export const searchWords = (query: string): string[] => normalizeForSearch(query).split(" ").filter(Boolean);

export function matchesSearch(text: string, words: readonly string[]): boolean {
  if (words.length === 0) return true;
  const hay = normalizeForSearch(text);
  return words.every((w) => hay.includes(w));
}

/** What the search narrows: table rows of the body, and cards marked with `<article>`. */
export const SEARCH_ITEMS = "tbody tr, article";
export const HIDDEN_ATTR = "data-search-hidden";

export interface SearchResult {
  /** Rows and cards on the screen. */
  total: number;
  shown: number;
}

/** Hides the items of `root` that do not match, shows the rest, and says how many are shown. An empty query shows everything. */
export function applySearch(root: ParentNode, query: string): SearchResult {
  const words = searchWords(query);
  const items = Array.from(root.querySelectorAll<HTMLElement>(SEARCH_ITEMS)).filter((el) => !el.closest("[data-search-skip]"));
  let shown = 0;
  for (const el of items) {
    const ok = words.length === 0 || matchesSearch(el.textContent ?? "", words);
    if (ok) {
      el.removeAttribute(HIDDEN_ATTR);
      shown += 1;
    } else {
      el.setAttribute(HIDDEN_ATTR, "");
    }
  }
  return { total: items.length, shown };
}
