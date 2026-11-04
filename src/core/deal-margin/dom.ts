/**
 * Browser-only wiring for the shared deal margin HTML: the Quoted / Forecast / Realized tabs and the live pre-bid
 * simulator. The app's client components and the promotional demo both call these, so they behave the same.
 * Nothing here talks to a server: the simulator is a calculation in the page and writes no record anywhere.
 */
import { readSimInputs, simulationResultHtml } from "./html";
import { runSimulation, type SimInputs } from "./simulate";

/** Makes every `[data-dm-tabs]` inside `root` switch panes when a tab is clicked, and arrow keys move between tabs. */
export function mountTabs(root: HTMLElement): () => void {
  const onClick = (e: Event) => {
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-dm-tab]");
    if (!btn) return;
    const box = btn.closest<HTMLElement>("[data-dm-tabs]");
    if (!box) return;
    const view = btn.dataset.dmTab;
    box.querySelectorAll<HTMLButtonElement>("[data-dm-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    box.querySelectorAll<HTMLElement>("[data-dm-pane]").forEach((p) => {
      p.hidden = p.dataset.dmPane !== view;
    });
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const btn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-dm-tab]");
    const tabs = btn ? [...(btn.closest("[data-dm-tabs]")?.querySelectorAll<HTMLButtonElement>("[data-dm-tab]") ?? [])] : [];
    if (!btn || tabs.length === 0) return;
    const next = tabs[(tabs.indexOf(btn) + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
    next.focus();
    next.click();
  };
  root.addEventListener("click", onClick);
  root.addEventListener("keydown", onKey);
  return () => {
    root.removeEventListener("click", onClick);
    root.removeEventListener("keydown", onKey);
  };
}

/** Recalculates the result block whenever any field of the simulator form changes. */
export function mountSimulator(root: HTMLElement, resultEl: HTMLElement, target: number | null): () => void {
  const form = root.querySelector<HTMLFormElement>("[data-dm-sim]");
  if (!form) return () => {};
  const run = () => {
    const inputs: SimInputs = readSimInputs((name) => (form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null)?.value ?? "");
    resultEl.innerHTML = simulationResultHtml(runSimulation(inputs, target));
  };
  form.addEventListener("input", run);
  form.addEventListener("change", run);
  run();
  return () => {
    form.removeEventListener("input", run);
    form.removeEventListener("change", run);
  };
}
