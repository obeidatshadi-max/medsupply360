import type { Metadata } from "next";
import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { FEATURE_MATRIX, LEVEL_LABEL, type Level } from "@/core/level";
import { requireUser } from "@/lib/auth/current-user";
import { currentLevel } from "@/lib/level";
import { setLevelAction } from "@/server/actions/level";

export const metadata: Metadata = { title: "Compare versions" };

const CARDS: { level: Level; eyebrow: string; title: string; text: string; points: string[]; button: string }[] = [
  {
    level: "basic",
    eyebrow: "VERSION 1 · BASIC",
    title: "Keep the company visible.",
    text: "Sales, gross margin, cash, stock risks and accountable actions in a short owner view.",
    points: ["The core operating screens", "Accounting exports from the ERP", "Minimal extra data entry", "Start with what the ERP already knows"],
    button: "Use the Basic version →",
  },
  {
    level: "advanced",
    eyebrow: "VERSION 2 · ADVANCED",
    title: "See why value is being lost.",
    text: "Connect installations, repeat consumables, tender costs, service agreements and department execution.",
    points: ["All Basic functions plus deeper operating screens", "Tenders, installed equipment, service and support functions", "Repeat revenue scenario and the opportunity radar", "More investigation context and data responsibility"],
    button: "Use the Advanced version →",
  },
];

export default async function CompareVersionsPage() {
  const user = await requireUser("settings");
  const current = await currentLevel();

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow={`${user.companyName} · Settings`}
        title="Compare versions"
        sub="Basic and Advanced use the same data. Choosing Basic only leaves the extra screens out of the menu: nothing is deleted, and you can switch back at any time from the top bar."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {CARDS.map((c) => (
          <section key={c.level} aria-label={LEVEL_LABEL[c.level]} className="flex flex-col rounded-lg border border-line bg-white p-5">
            <p className="text-[10px] font-bold uppercase tracking-[2px] text-brand">
              {c.eyebrow}
              {c.level === current ? " · YOU ARE HERE" : ""}
            </p>
            <h2 className="mt-1.5 text-lg font-medium">{c.title}</h2>
            <p className="mt-1 text-sm text-muted">{c.text}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {c.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <form action={setLevelAction} className="mt-4">
              <input type="hidden" name="level" value={c.level} />
              <input type="hidden" name="jump" value="/dashboard" />
              <button type="submit" disabled={c.level === current} className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747] disabled:opacity-60">
                {c.level === current ? "You are using this version" : c.button}
              </button>
            </form>
          </section>
        ))}
      </div>

      <section aria-label="Comparison">
        <h2 className="text-sm font-semibold">Compare simplicity and benefit</h2>
        <div className="mt-2 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Area</th>
                <th className="px-3 py-2 font-medium">Basic</th>
                <th className="px-3 py-2 font-medium">Advanced</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map(([area, basic, advanced]) => (
                <tr key={area} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-medium">{area}</td>
                  <td className="px-3 py-2">{basic}</td>
                  <td className="px-3 py-2">{advanced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-muted">The review times are planning guesses, not measured results. Basic is the lighter place to start. Advanced is useful when the extra records are kept up to date.</p>
      </section>

      <p className="text-sm">
        <Link href="/imports" className="text-brand underline underline-offset-2">
          See the data channels: what to load and how often
        </Link>
      </p>
    </div>
  );
}
