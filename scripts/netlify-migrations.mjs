// Mirrors Drizzle migrations (drizzle/NNNN_name.sql) into the layout Netlify Database applies on deploy:
// netlify/database/migrations/NNNN_name-with-hyphens/migration.sql. Run after `npm run db:generate`.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export function netlifyMigrationDir(file) {
  const [, num, name] = file.match(/^(\d+)_(.+)\.sql$/);
  return `${num}_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of readdirSync("drizzle").filter((f) => f.endsWith(".sql")).sort()) {
    // Netlify needs a unique number per migration, and some Netlify migrations (for example a one-off data fix) have no
    // Drizzle file. A Drizzle migration already mirrored under a later number keeps that number instead of being copied twice.
    const base = "netlify/database/migrations";
    const name = netlifyMigrationDir(file).replace(/^\d+_/, "");
    const existing = existsSync(base) ? readdirSync(base).find((d) => d.replace(/^\d+_/, "") === name) : undefined;
    // A new migration whose Drizzle number is already taken by another Netlify migration goes after the last one.
    const taken = existsSync(base) ? readdirSync(base) : [];
    const wanted = netlifyMigrationDir(file);
    const clash = taken.some((d) => d.slice(0, 4) === wanted.slice(0, 4));
    const next = String(Math.max(0, ...taken.map((d) => Number(d.slice(0, 4)))) + 1).padStart(4, "0");
    const dir = join(base, existing ?? (clash ? `${next}_${name}` : wanted));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "migration.sql"), readFileSync(join("drizzle", file)));
    console.log(`✓ ${dir}/migration.sql`);
  }
}
