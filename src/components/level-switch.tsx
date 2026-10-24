import { LEVELS, LEVEL_LABEL, type Level } from "@/core/level";
import { setLevelAction } from "@/server/actions/level";

/** The small Basic | Advanced switch in the top bar. It changes which screens the menu lists, not what data is loaded. */
export function LevelSwitch({ current }: { current: Level }) {
  return (
    <form action={setLevelAction} role="group" aria-label="Choose dashboard level" className="flex overflow-hidden rounded-[7px] border border-line text-xs">
      {LEVELS.map((l) => (
        <button key={l} type="submit" name="level" value={l} aria-pressed={l === current} className={`px-2.5 py-1.5 ${l === current ? "bg-brand text-brand-ink" : "bg-white hover:bg-[#f0f6f2]"}`}>
          {LEVEL_LABEL[l]}
        </button>
      ))}
    </form>
  );
}
