"use server";

import bcrypt from "bcryptjs";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { companies, passwordResets, users } from "@/db/schema";
import { writeAudit } from "@/lib/audit";
import { createSession } from "@/lib/auth/session";
import {
  LIMITS,
  PASSWORD_MESSAGES,
  RESET_TTL_MINUTES,
  hashToken,
  newResetToken,
  normalizeEmail,
  passwordProblem,
  checkInviteCode,
  resetState,
  signupInviteCode,
  slugify,
  withSuffix,
} from "@/lib/domain/account";
import { appUrl, mailConfigured, sendMail } from "../services/mailer";
import { clientIp } from "../services/login-throttle";
import { recentCount } from "../services/rate-limit";

// ─── Sign up ─────────────────────────────────────────────────────────────────

export type SignupState = { error?: string; values?: { fullName: string; email: string; companyName: string } };

const signupSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(200),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(255),
  companyName: z.string().trim().min(2, "Enter your company name.").max(200),
  password: z.string().max(200),
});

/** Postgres unique-violation details, whether thrown directly or wrapped by Drizzle. */
function uniqueViolation(err: unknown): string | null {
  const e = err as { code?: string; constraint?: string; cause?: { code?: string; constraint?: string } };
  const code = e?.code ?? e?.cause?.code;
  return code === "23505" ? (e.constraint ?? e.cause?.constraint ?? "unique") : null;
}

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const raw = {
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    companyName: String(formData.get("companyName") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
  const values = { fullName: raw.fullName, email: raw.email, companyName: raw.companyName };
  // Honeypot: real visitors never see or fill this field.
  if (String(formData.get("website") ?? "") !== "") return { error: "Something went wrong. Try again.", values };

  const invite = checkInviteCode(signupInviteCode(), String(formData.get("inviteCode") ?? ""));
  if (invite === "closed") return { error: "Sign-up is by invitation only. Ask your administrator for access.", values };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form.", values };
  const { fullName, email, companyName, password } = parsed.data;
  const problem = passwordProblem(password, email);
  if (problem) return { error: PASSWORD_MESSAGES[problem], values };

  const ip = await clientIp();
  const { byIp } = await recentCount("auth.signup", { ip }, LIMITS.windowMinutes);
  if (ip && byIp >= LIMITS.signupPerIp) return { error: "Too many accounts were created from this network. Try again in an hour.", values };

  if (invite === "wrong") {
    // Guessing the code is throttled like signing up: refused attempts count against the same per-address limit.
    const refused = await recentCount("auth.signup_refused", { ip }, LIMITS.windowMinutes);
    if (ip && refused.byIp >= LIMITS.signupPerIp) return { error: "Too many attempts from this network. Try again in an hour.", values };
    await writeAudit({ userId: null, action: "auth.signup_refused", details: { email, ip, reason: "invite_code" } });
    return { error: "That invitation code is not valid.", values };
  }

  const db = getDb();
  const passwordHash = await bcrypt.hash(password, 12);
  const baseSlug = slugify(companyName);
  let created: { userId: string; companyId: string } | null = null;
  for (let attempt = 0; attempt < 5 && !created; attempt++) {
    const slug = attempt === 0 ? baseSlug : withSuffix(baseSlug, Math.random().toString(36).slice(2, 6));
    try {
      created = await db.transaction(async (tx) => {
        const [company] = await tx.insert(companies).values({ slug, name: companyName }).returning({ id: companies.id });
        const [user] = await tx
          .insert(users)
          .values({ companyId: company!.id, email, passwordHash, fullName, role: "owner" })
          .returning({ id: users.id });
        return { userId: user!.id, companyId: company!.id };
      });
    } catch (err) {
      const constraint = uniqueViolation(err);
      if (constraint?.includes("email")) return { error: "An account with this email already exists. Sign in or reset your password.", values };
      if (!constraint) throw err; // not a slug collision: surface it (logged by the platform)
    }
  }
  if (!created) return { error: "Could not create the account. Try again.", values };

  await writeAudit({ companyId: created.companyId, userId: created.userId, action: "auth.signup", details: { email, ip } });
  await createSession(created.userId);
  redirect("/dashboard");
}

// ─── Forgot password ─────────────────────────────────────────────────────────

export type ForgotState = { status?: "sent" | "notConfigured" | "invalid"; email?: string };

export async function requestResetAction(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const parsed = z.string().email().max(255).safeParse(normalizeEmail(String(formData.get("email") ?? "")));
  if (!parsed.success) return { status: "invalid", email: String(formData.get("email") ?? "") };
  const email = parsed.data;
  if (!mailConfigured()) return { status: "notConfigured", email };

  const ip = await clientIp();
  const recent = await recentCount("auth.reset_requested", { email, ip }, LIMITS.windowMinutes);
  await writeAudit({ userId: null, action: "auth.reset_requested", details: { email, ip } });
  const limited = recent.byEmail >= LIMITS.resetPerEmail || (ip !== null && recent.byIp >= LIMITS.resetPerIp);

  if (!limited) {
    // Work after the response is sent, so response time does not reveal whether the email has an account.
    after(async () => {
      try {
        const db = getDb();
        const [user] = await db
          .select({ id: users.id, companyId: users.companyId, fullName: users.fullName })
          .from(users)
          .where(and(sql`lower(${users.email}) = ${email}`, eq(users.active, true)))
          .limit(1);
        const base = appUrl();
        if (!user || !base) {
          if (user && !base) console.error("APP_URL (or URL) is not set; cannot build a password-reset link.");
          return;
        }
        const { token, tokenHash } = newResetToken();
        await db.insert(passwordResets).values({ userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) });
        const link = `${base}/reset-password?token=${token}`;
        await sendMail(
          email,
          "Reset your MedSupply360 password",
          `Hello ${user.fullName},\n\nUse this link to choose a new password. It works once and expires in ${RESET_TTL_MINUTES} minutes:\n${link}\n\nIf you did not ask for this, ignore this email; your password stays the same.`,
          `<p>Hello ${escapeHtml(user.fullName)},</p><p><a href="${link}">Choose a new password</a>. The link works once and expires in ${RESET_TTL_MINUTES} minutes.</p><p>If you did not ask for this, ignore this email; your password stays the same.</p>`,
        );
        await writeAudit({ companyId: user.companyId, userId: user.id, action: "auth.reset_email_sent" });
      } catch (err) {
        console.error("Password-reset email failed:", err instanceof Error ? err.message : err);
      }
    });
  }
  return { status: "sent", email };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

// ─── Reset password ──────────────────────────────────────────────────────────

export type ResetState = { error?: string };

export async function resetPasswordAction(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password !== confirm) return { error: "The two passwords do not match." };

  const db = getDb();
  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ id: passwordResets.id, userId: passwordResets.userId, expiresAt: passwordResets.expiresAt, usedAt: passwordResets.usedAt, email: users.email, active: users.active, companyId: users.companyId })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(eq(passwordResets.tokenHash, tokenHash))
    .limit(1);
  if (!row || !row.active || resetState(row, new Date()) !== "valid") return { error: "This reset link is invalid or has expired. Request a new one." };

  const problem = passwordProblem(password, row.email);
  if (problem) return { error: PASSWORD_MESSAGES[problem] };

  const passwordHash = await bcrypt.hash(password, 12);
  const ok = await db.transaction(async (tx) => {
    // Claim the token atomically: a second submit of the same link finds nothing to claim.
    const claimed = await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.id, row.id), isNull(passwordResets.usedAt)))
      .returning({ id: passwordResets.id });
    if (claimed.length === 0) return false;
    await tx.update(users).set({ passwordHash, passwordChangedAt: new Date() }).where(eq(users.id, row.userId));
    await tx
      .update(passwordResets)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResets.userId, row.userId), isNull(passwordResets.usedAt), ne(passwordResets.id, row.id)));
    return true;
  });
  if (!ok) return { error: "This reset link was already used. Request a new one." };

  await writeAudit({ companyId: row.companyId, userId: row.userId, action: "auth.password_reset" });
  redirect("/login?reset=1");
}
