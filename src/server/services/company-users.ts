import bcrypt from "bcryptjs";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db/import-writer";
import { users } from "@/db/schema";
import { isAssignableRole, type AssignableRole, type Role } from "@/core/permissions";
import { PASSWORD_MESSAGES, normalizeEmail, passwordProblem } from "@/lib/domain/account";

export type CompanyUserRow = {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: Date | null;
};

export type UserChange = { ok: true; userId?: string } | { ok: false; error: string };

/** Everyone in one company, owner first. Never returns another company's users or any password data. */
export async function listCompanyUsers(db: Db, companyId: string): Promise<CompanyUserRow[]> {
  return db
    .select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, active: users.active, lastLoginAt: users.lastLoginAt })
    .from(users)
    .where(eq(users.companyId, companyId))
    .orderBy(sql`(${users.role} = 'owner') desc`, asc(users.fullName));
}

const newUserSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the person's full name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
});

/** The owner adds a colleague with a first password to hand over. The owner role cannot be given here. */
export async function createCompanyUser(
  db: Db,
  input: { companyId: string; fullName: string; email: string; role: string; password: string },
): Promise<UserChange> {
  const parsed = newUserSchema.safeParse({ fullName: input.fullName, email: normalizeEmail(input.email) });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  if (!isAssignableRole(input.role)) return { ok: false, error: "Choose a role for this person." };
  const problem = passwordProblem(input.password, parsed.data.email);
  if (problem) return { ok: false, error: PASSWORD_MESSAGES[problem] };

  const [taken] = await db.select({ id: users.id }).from(users).where(sql`lower(${users.email}) = ${parsed.data.email}`).limit(1);
  if (taken) return { ok: false, error: "An account with this email already exists." };

  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const [row] = await db
      .insert(users)
      .values({ companyId: input.companyId, email: parsed.data.email, passwordHash, fullName: parsed.data.fullName, role: input.role })
      .returning({ id: users.id });
    return { ok: true, userId: row!.id };
  } catch {
    // Two people adding the same email at once: the unique index decides.
    return { ok: false, error: "An account with this email already exists." };
  }
}

async function editableTarget(db: Db, companyId: string, actorId: string, userId: string): Promise<{ ok: false; error: string } | { ok: true }> {
  if (userId === actorId) return { ok: false, error: "You cannot change your own access here." };
  const [target] = await db.select({ role: users.role }).from(users).where(and(eq(users.id, userId), eq(users.companyId, companyId))).limit(1);
  if (!target) return { ok: false, error: "That user was not found." };
  if (target.role === "owner") return { ok: false, error: "The owner's access cannot be changed here." };
  return { ok: true };
}

export async function changeUserRole(db: Db, input: { companyId: string; actorId: string; userId: string; role: string }): Promise<UserChange> {
  if (!isAssignableRole(input.role)) return { ok: false, error: "Choose a role for this person." };
  const check = await editableTarget(db, input.companyId, input.actorId, input.userId);
  if (!check.ok) return check;
  await db.update(users).set({ role: input.role as AssignableRole }).where(and(eq(users.id, input.userId), eq(users.companyId, input.companyId)));
  return { ok: true };
}

export async function setUserActive(db: Db, input: { companyId: string; actorId: string; userId: string; active: boolean }): Promise<UserChange> {
  const check = await editableTarget(db, input.companyId, input.actorId, input.userId);
  if (!check.ok) return check;
  await db.update(users).set({ active: input.active }).where(and(eq(users.id, input.userId), eq(users.companyId, input.companyId)));
  return { ok: true };
}
