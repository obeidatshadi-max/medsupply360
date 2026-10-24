"use server";

import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { passwordResets, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/current-user";
import { createSession } from "@/lib/auth/session";
import { PASSWORD_MESSAGES, passwordProblem } from "@/lib/domain/account";
import { clientIp } from "../services/login-throttle";
import { recentCount } from "../services/rate-limit";

export type ChangePasswordState = { error?: string; done?: boolean };

const ATTEMPT_LIMIT = 5;
const WINDOW_MINUTES = 60;

export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  const user = await requireUser("any");
  if (user.guest) return { error: "Sign in to change a password." };

  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two new passwords do not match." };
  if (password === current) return { error: "Choose a password different from the current one." };
  const problem = passwordProblem(password, user.email);
  if (problem) return { error: PASSWORD_MESSAGES[problem] };

  const ip = await clientIp();
  // The attempt is recorded BEFORE the password is compared and counted with itself included, so parallel requests
  // cannot all pass a check made before any of them is written.
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "auth.password_change_attempt", details: { email: user.email, ip } });
  const { byEmail } = await recentCount("auth.password_change_attempt", { email: user.email }, WINDOW_MINUTES);
  if (byEmail > ATTEMPT_LIMIT) return { error: "Too many attempts. Try again in an hour." };

  const db = getDb();
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await bcrypt.compare(current, row.passwordHash))) {
    return { error: "The current password is not correct." };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.id, user.id));
    // A reset link emailed earlier must not set the password back.
    await tx.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));
  });
  await writeAudit({ companyId: user.companyId, userId: user.id, action: "auth.password_changed" });
  // The change revokes every earlier session, including this one: issue a fresh session so this browser stays signed in.
  await createSession(user.id);
  return { done: true };
}
