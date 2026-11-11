import { readFileSync, readdirSync } from "node:fs";
import { readUploadedFile } from "./src/core/import/read-file";
import { nearestKind } from "./src/core/import/detect";
import { applySmartMatch, smartKind } from "./src/core/import/smart-columns";
import { validateImport } from "./src/core/import/validate";
const dir = process.argv[2]!;
for (const f of readdirSync(dir).sort()) {
  try {
    const sheets = await readUploadedFile(f, new Blob([readFileSync(`${dir}/${f}`)]));
    for (const s of sheets) {
      if (s.skipped) { console.log(f, "skipped:", s.skipped); continue; }
      const near = s.kind === null ? nearestKind(s.csv) : null;
      const sk = s.kind === null && near === null ? smartKind(s.csv) : null;
      const kind = s.kind ?? near ?? sk;
      if (!kind) { console.log(`${f}: NO TYPE. head=${s.csv.split("\n")[0]}`); continue; }
      const { csv, matched } = applySmartMatch(kind, s.csv);
      const r = validateImport(kind, csv, { today: "2026-11-11" });
      console.log(`${f}: ${kind} (${s.kind ? "recognised" : near ? "near" : "smart"}) auto=${JSON.stringify(matched)} ok=${r.accepted.length} rej=${r.rejected.length} fatal=${r.fatal ?? ""}`);
      for (const x of r.rejected.slice(0, 3)) console.log("   rej", x.row, x.reason);
      for (const x of r.warnings.slice(0, 3)) console.log("   warn", x.row, x.reason.slice(0, 90));
      if (r.accepted[0]) console.log("   first", JSON.stringify(r.accepted[0].values).slice(0, 200));
    }
  } catch (e) { console.log(f, "THREW", (e as Error).message.slice(0, 150)); }
}
