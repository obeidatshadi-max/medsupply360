import { LINE_OPTIONS, parseLine } from "@/core/line-filter";
import type { Line } from "@/core/sales-by-line";
import { setLineAction } from "@/server/actions/line";

/**
 * The business-line filter, as on the demo: All lines, Equipment, Devices, Consumables. The choice is remembered, so the
 * next screen opens on the same line. `note` says what on this screen is not split by line.
 */
export function LineFilter({ current, note }: { current: Line | null; note?: string }) {
  return (
    <div className="mb-4">
      <div role="group" aria-label="Business line filter" className="flex flex-wrap gap-2">
        {LINE_OPTIONS.map((opt) => {
          const active = (parseLine(opt) ?? null) === current;
          return (
            <form key={opt} action={setLineAction}>
              <input type="hidden" name="line" value={opt} />
              <button type="submit" aria-pressed={active} className={`rounded-full border px-3 py-1 text-xs ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-white hover:border-brand"}`}>
                {opt}
              </button>
            </form>
          );
        })}
      </div>
      {note ? <p className="mt-1 text-xs text-muted">{note}</p> : null}
    </div>
  );
}
