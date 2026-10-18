/**
 * Settings → People and access, against a real Postgres engine (PGlite) with the real migrations: the department roles
 * exist, users are scoped to one company, the owner role is never handed out, and the owner cannot lock themselves out.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import type { Db } from "@/db/import-writer";
import { changeUserRole, createCompanyUser, listCompanyUsers, setUserActive } from "@/server/services/company-users";

let client: PGlite;
let db: Db;
let companyA: string;
let companyB: string;
let ownerA: string;
let ownerB: string;
const q = async <T>(sql: string) => (await client.query<T>(sql)).rows;
const PASSWORD = "correct-horse-battery";

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client, { schema }) as unknown as Db;
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  }
  companyA = (await q<{ id: string }>(`insert into companies (slug, name) values ('a', 'A') returning id`))[0]!.id;
  companyB = (await q<{ id: string }>(`insert into companies (slug, name) values ('b', 'B') returning id`))[0]!.id;
  ownerA = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${companyA}', 'ceo@a.test', 'x', 'Owner A', 'owner') returning id`))[0]!.id;
  ownerB = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${companyB}', 'ceo@b.test', 'x', 'Owner B', 'owner') returning id`))[0]!.id;
}, 60_000);
afterAll(async () => client.close());

describe("company users", () => {
  it("adds a tender user who can later be listed with the department role", async () => {
    const r = await createCompanyUser(db, { companyId: companyA, fullName: "Lina Tender", email: " Lina@A.test ", role: "tender", password: PASSWORD });
    expect(r.ok).toBe(true);
    const people = await listCompanyUsers(db, companyA);
    expect(people.map((p) => [p.email, p.role])).toEqual([["ceo@a.test", "owner"], ["lina@a.test", "tender"]]);
  });

  it("never hands out the owner role and rejects unknown roles", async () => {
    for (const role of ["owner", "root", ""]) {
      const r = await createCompanyUser(db, { companyId: companyA, fullName: "Someone", email: `${role || "none"}@a.test`, role, password: PASSWORD });
      expect(r).toEqual({ ok: false, error: "Choose a role for this person." });
    }
  });

  it("rejects a weak password, a bad email and a duplicate email (even from another company)", async () => {
    expect((await createCompanyUser(db, { companyId: companyA, fullName: "Weak", email: "weak@a.test", role: "finance", password: "short" })).ok).toBe(false);
    expect((await createCompanyUser(db, { companyId: companyA, fullName: "Bad", email: "not-an-email", role: "finance", password: PASSWORD })).ok).toBe(false);
    const dup = await createCompanyUser(db, { companyId: companyB, fullName: "Dup", email: "LINA@a.test", role: "finance", password: PASSWORD });
    expect(dup).toEqual({ ok: false, error: "An account with this email already exists." });
  });

  it("lists only the company's own people", async () => {
    const b = await listCompanyUsers(db, companyB);
    expect(b.map((p) => p.email)).toEqual(["ceo@b.test"]);
  });

  it("changes a role and turns a person off, only inside the owner's company", async () => {
    const lina = (await listCompanyUsers(db, companyA)).find((p) => p.email === "lina@a.test")!;
    expect(await changeUserRole(db, { companyId: companyA, actorId: ownerA, userId: lina.id, role: "finance" })).toEqual({ ok: true });
    expect((await listCompanyUsers(db, companyA)).find((p) => p.id === lina.id)!.role).toBe("finance");
    expect(await setUserActive(db, { companyId: companyA, actorId: ownerA, userId: lina.id, active: false })).toEqual({ ok: true });
    expect((await listCompanyUsers(db, companyA)).find((p) => p.id === lina.id)!.active).toBe(false);

    // Another company's owner cannot touch Lina.
    expect(await changeUserRole(db, { companyId: companyB, actorId: ownerB, userId: lina.id, role: "viewer" })).toEqual({ ok: false, error: "That user was not found." });
    expect(await setUserActive(db, { companyId: companyB, actorId: ownerB, userId: lina.id, active: true })).toEqual({ ok: false, error: "That user was not found." });
    expect((await listCompanyUsers(db, companyA)).find((p) => p.id === lina.id)!.role).toBe("finance");
  });

  it("stops the owner from changing or switching off their own access, and protects owner accounts", async () => {
    expect(await changeUserRole(db, { companyId: companyA, actorId: ownerA, userId: ownerA, role: "viewer" })).toEqual({ ok: false, error: "You cannot change your own access here." });
    expect(await setUserActive(db, { companyId: companyA, actorId: ownerA, userId: ownerA, active: false })).toEqual({ ok: false, error: "You cannot change your own access here." });
    const second = (await q<{ id: string }>(`insert into users (company_id, email, password_hash, full_name, role) values ('${companyA}', 'co@a.test', 'x', 'Co Owner', 'owner') returning id`))[0]!.id;
    expect(await changeUserRole(db, { companyId: companyA, actorId: ownerA, userId: second, role: "viewer" })).toEqual({ ok: false, error: "The owner's access cannot be changed here." });
  });

  it("refuses to promote anyone to owner through a role change", async () => {
    const lina = (await listCompanyUsers(db, companyA)).find((p) => p.email === "lina@a.test")!;
    expect(await changeUserRole(db, { companyId: companyA, actorId: ownerA, userId: lina.id, role: "owner" })).toEqual({ ok: false, error: "Choose a role for this person." });
  });
});
