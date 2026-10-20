"use client";

import { useState } from "react";
import { recoveryScenario } from "@/core/installed-base";
import { jod } from "@/lib/format";

/** "What if we win back part of the gap?": two sliders, the same arithmetic as the tests. An estimate, not a promise. */
export function RecoveryScenario({ gapMonthly }: { gapMonthly: number }) {
  const [share, setShare] = useState(40);
  const [margin, setMargin] = useState(25);
  const r = recoveryScenario(gapMonthly, share / 100, margin / 100);
  return (
    <section aria-label="Recovery scenario" className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-sm font-semibold">If part of the gap is won back</h2>
      <p className="mt-1 text-xs text-muted">Move the sliders to see the yearly effect. The margin is your own assumption: replace it with the real margin on consumables.</p>
      <label className="mt-4 block text-sm">
        Share of the monthly gap won back: <b>{share}%</b>
        <input type="range" min={0} max={100} value={share} onChange={(e) => setShare(Number(e.target.value))} className="mt-1 block w-full" />
      </label>
      <label className="mt-3 block text-sm">
        Margin on the extra consumables: <b>{margin}%</b>
        <input type="range" min={0} max={60} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="mt-1 block w-full" />
      </label>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Extra sales per year</dt>
          <dd className="text-lg tabular-nums">{jod(Math.round(r.annualRevenue))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Extra profit per year</dt>
          <dd className="text-lg tabular-nums">{jod(Math.round(r.annualProfit))}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">Assumes the same demand for 12 months. Leaves out tax, financing and capacity limits.</p>
    </section>
  );
}
