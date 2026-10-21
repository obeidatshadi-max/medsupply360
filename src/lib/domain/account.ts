/** Account rules: password policy, company slug, reset-token handling and rate limits. Pure and testable. */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;

export type PasswordProblem = "short" | "long" | "sameAsEmail" | "tooCommon";

const COMMON = new Set(["password", "password1", "1234567890", "12345678910", "qwertyuiop", "1q2w3e4r5t", "iloveyou12", "administrator"]);

export function passwordProblem(password: string, email = ""): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return "short";
  if (password.length > PASSWORD_MAX) return "long";
  const p = password.toLowerCase();
  if (email && p === email.trim().toLowerCase()) return "sameAsEmail";
  if (COMMON.has(p) || /^(.)\1+$/.test(p)) return "tooCommon";
  return null;
}

export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  short: `Use at least ${PASSWORD_MIN} characters.`,
  long: `Use at most ${PASSWORD_MAX} characters.`,
  sameAsEmail: "The password must not be your email address.",
  tooCommon: "That password is too easy to guess. Choose another.",
};

/** URL-safe company slug: lowercase letters, digits and hyphens, 2 to 48 characters. */
export function slugify(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
  return base.length >= 2 ? base : "company";
}

export const withSuffix = (slug: string, suffix: string): string => `${slug.slice(0, 48 - suffix.length - 1)}-${suffix}`.replace(/-+/g, "-");

export const RESET_TTL_MINUTES = 60;

/** A fresh random reset token (sent by email) and the hash that is stored. */
export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export type ResetState = "valid" | "expired" | "used" | "unknown";

export function resetState(row: { expiresAt: Date; usedAt: Date | null } | undefined, now: Date): ResetState {
  if (!row) return "unknown";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

/** Abuse limits, counted from the audit log over the window. */
export const LIMITS = {
  windowMinutes: 60,
  signupPerIp: 5,
  resetPerEmail: 3,
  resetPerIp: 10,
} as const;

/**
 * Sign-up is closed unless SIGNUP_INVITE_CODE is set; when set, the visitor must type that code.
 * Returns null when sign-up is closed.
 */
export const signupInviteCode = (env: Record<string, string | undefined> = process.env): string | null => env.SIGNUP_INVITE_CODE?.trim() || null;

export type InviteCheck = "closed" | "wrong" | "ok";

/** Compares hashes of both codes in constant time, so the response time does not leak the code. */
export function checkInviteCode(expected: string | null, given: string): InviteCheck {
  if (!expected) return "closed";
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(given.trim()).digest();
  return timingSafeEqual(a, b) ? "ok" : "wrong";
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
