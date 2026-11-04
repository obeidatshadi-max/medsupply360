import { DEAL_MARGIN_CSS } from "@/core/deal-margin/html";

/** The shared deal-margin stylesheet. Render once per page. */
export function DealStyle() {
  return <style>{DEAL_MARGIN_CSS}</style>;
}

/** Static report HTML from the shared engine presentation (core/deal-margin/html). Every dynamic value there is escaped. */
export function DealHtml({ html }: { html: string }) {
  return <div className="dm" dangerouslySetInnerHTML={{ __html: html }} />;
}
