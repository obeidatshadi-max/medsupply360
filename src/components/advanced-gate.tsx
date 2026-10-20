import { LEVEL_LABEL } from "@/core/level";
import { setLevelAction } from "@/server/actions/level";
import { PageHeading } from "@/components/page-heading";

/** Shown instead of a screen that belongs to the Advanced version, when the person is on Basic. One button switches over. */
export function AdvancedGate({ title }: { title: string }) {
  return (
    <div>
      <PageHeading eyebrow={title} title={title} sub={`This screen is part of the ${LEVEL_LABEL.advanced} version. You are on ${LEVEL_LABEL.basic}, which keeps the menu short. Switching changes only what the menu lists; no data is lost.`} />
      <form action={setLevelAction}>
        <input type="hidden" name="level" value="advanced" />
        <button type="submit" className="rounded-[7px] bg-brand px-4 py-2 text-sm font-semibold text-brand-ink hover:bg-[#125747]">
          Switch to Advanced
        </button>
      </form>
    </div>
  );
}
