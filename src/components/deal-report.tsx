"use client";

import { useEffect, useRef } from "react";
import { mountSimulator, mountTabs } from "@/core/deal-margin/dom";
import { DEAL_MARGIN_CSS, simulatorFormHtml } from "@/core/deal-margin/html";
import type { SimInputs } from "@/core/deal-margin";

/**
 * Report HTML produced by the shared engine presentation (core/deal-margin/html). Every dynamic value in that HTML is
 * escaped there; this component only injects it and wires the Quoted / Forecast / Realized tabs.
 */
export function DealReport({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => (ref.current ? mountTabs(ref.current) : undefined), [html]);
  return (
    <div className="dm">
      <style>{DEAL_MARGIN_CSS}</style>
      <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** The pre-bid simulator: a form and a live result, calculated in the page. It calls no server action and writes nothing. */
export function DealSimulator({ defaults, target }: { defaults: SimInputs; target: number | null }) {
  const root = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => (root.current && result.current ? mountSimulator(root.current, result.current, target) : undefined), [target]);
  return (
    <div className="dm">
      <style>{DEAL_MARGIN_CSS}</style>
      <div ref={root} dangerouslySetInnerHTML={{ __html: simulatorFormHtml(defaults) }} />
      <div ref={result} aria-live="polite" className="mt-4" />
    </div>
  );
}
