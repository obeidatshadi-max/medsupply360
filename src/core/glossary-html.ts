/**
 * HTML for the term hint in the promotional demo (plain HTML, no React). It matches the app's InfoTerm component:
 * the same words, the same (i) button, the same "Learn more" section. The demo page wires the clicks (see demo/index.html).
 */
import { glossaryEntry, hasMore } from "./glossary";

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** A label with a small (i) button after it. `label` is HTML that the caller has already made safe. An unknown term gives just the label. */
export function tipHtml(term: string, label?: string): string {
  const e = glossaryEntry(term);
  const text = label ?? esc(term);
  if (!e) return text;
  return `<span class="tipw"><span>${text}</span><button type="button" class="tipb" data-tip="${esc(e.term)}" aria-expanded="false" aria-label="What does ${esc(e.term)} mean?"><span aria-hidden="true">i</span></button></span>`;
}

/** The inside of the open explanation. `moreId` links the "Learn more" button to the section it opens. */
export function tipPanelHtml(term: string, moreId: string): string {
  const e = glossaryEntry(term);
  if (!e) return "";
  const parts = [
    e.example ? `<span class="tipx"><b>Example: </b>${esc(e.example)}</span>` : "",
    e.why ? `<span class="tipx"><b>Why it matters: </b>${esc(e.why)}</span>` : "",
    e.action ? `<span class="tipx"><b>What you can do: </b>${esc(e.action)}</span>` : "",
  ].join("");
  const more = hasMore(e)
    ? `<span class="tipm"><button type="button" class="tipmore" aria-expanded="false" aria-controls="${esc(moreId)}">Learn more</button><span id="${esc(moreId)}" class="tipdeep" hidden>${parts}</span></span>`
    : "";
  return `<span class="tipt">${esc(e.term)}</span><span class="tips">${esc(e.short)}</span>${more}`;
}
