/**
 * End-to-end account workflows against a real Postgres engine (PGlite) with the project's actual migrations.
 * Only the Next.js request plumbing (cookies, headers, redirect, after) and the email provider are replaced.
 */
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";

const h = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  state: { ip: "1.1.1.1" as string | null, mailOn: true, sent: [] as { to: string; subject: string; text: string }[], pending: [] as Promise<unknown>[] },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) => (h.jar.has(n) ? { name: n, value: h.jar.get(n)! } : undefined),
    set: (n: string, v: string) => void h.jar.set(n, v),
    delete: (n: string) => void h.jar.delete(n),
  }),
  headers: async () => new Headers(h.state.ip ? { "x-nf-client-connection-ip": h.state.ip } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/server", () => ({
  after: (fn: () => unknown) => void h.state.pending.push(Promise.resolve().then(fn)),
  connection: async () => {},
}));
vi.mock("@/server/services/mailer", () => ({
  mailConfigured: () => h.state.mailOn,
  appUrl: () => "https://app.test",
  sendMail: async (to: string, subject: string, text: string) => {
    h.state.sent.push({ to, subject, text });
    return true;
  },
}));

type Actions = typeof import("@/server/actions/account");
type Auth = typeof import("@/server/actions/auth");
let client: PGlite;
let db: ReturnType<typeof drizzle<typeof schema>>;
let acct: Actions;
let auth: Auth;
let currentUser: typeof import("@/lib/auth/current-user");
let bootstrap: typeof import("@/server/bootstrap-owner");

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};
const redirected = async (p: Promise<unknown>): Promise<string> => {
  try {
    await p;
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("REDIRECT:")) return m.slice(9);
    throw e;
  }
  throw new Error("expected a redirect");
};
const flush = async () => {
  await Promise.all(h.state.pending.splice(0));
};
const attempts = async () => Number((await client.query<{ n: string }>(`select count(*)::int as n from audit_logs where action = 'auth.signup_attempt'`)).rows[0]!.n);
const INVITE = "pilot-invite-2026";
const signup = (over: Record<string, string> = {}) =>
  acct.signupAction({}, fd({ fullName: "Shadi O", email: "shadi@example.com", companyName: "Sadaf Medical", password: "blue-Table-92!", inviteCode: INVITE, ...over }));
const count = async (table: string) => Number((await client.query<{ n: string }>(`select count(*)::int as n from ${table}`)).rows[0]!.n);

beforeAll(async () => {
  process.env.SESSION_SECRET = "0123456789012345678901234567890123456789";
  client = new PGlite();
  const dir = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort())
    for (const stmt of readFileSync(dir + f, "utf8").split("--> statement-breakpoint")) if (stmt.trim()) await client.exec(stmt);
  db = drizzle(client, { schema });
  (globalThis as unknown as { __sadafDb: unknown }).__sadafDb = db;
  acct = await import("@/server/actions/account");
  auth = await import("@/server/actions/auth");
  currentUser = await import("@/lib/auth/current-user");
  bootstrap = await import("@/server/bootstrap-owner");
});
afterAll(async () => {
  vi.useRealTimers();
  await client.close();
});
beforeEach(async () => {
  vi.useRealTimers();
  await client.exec("truncate audit_logs, password_resets, users, companies cascade");
  h.jar.clear();
  Object.assign(h.state, { ip: "1.1.1.1", mailOn: true, sent: [], pending: [] });
  process.env.SIGNUP_INVITE_CODE = INVITE;
});

describe("sign up", () => {
  it("creates a company and its owner, signs in and goes to the dashboard", async () => {
    expect(await redirected(signup())).toBe("/dashboard");
    const [u] = await db.select().from(schema.users);
    const [c] = await db.select().from(schema.companies);
    expect(u).toMatchObject({ email: "shadi@example.com", role: "owner", active: true });
    expect(u!.passwordHash).not.toContain("blue-Table");
    expect(c).toMatchObject({ slug: "sadaf-medical", name: "Sadaf Medical", currency: "JOD" });
    expect(u!.companyId).toBe(c!.id);
    const me = await currentUser.getCurrentUser();
    expect(me).toMatchObject({ email: "shadi@example.com", role: "owner", companyName: "Sadaf Medical", guest: false });
  });
  it("rejects a duplicate email in any letter case and leaves no orphan company", async () => {
    await redirected(signup());
    const r = await signup({ email: "SHADI@Example.com", companyName: "Another Co" });
    expect(r.error).toMatch(/already exists/);
    expect(await count("users")).toBe(1);
    expect(await count("companies")).toBe(1);
  });
  it("gives a second company with the same name a different slug", async () => {
    await redirected(signup());
    await redirected(signup({ email: "second@example.com" }));
    const slugs = (await db.select({ s: schema.companies.slug }).from(schema.companies)).map((x) => x.s);
    expect(new Set(slugs).size).toBe(2);
    expect(slugs[0]).toBe("sadaf-medical");
    expect(slugs[1]).toMatch(/^sadaf-medical-[a-z0-9]{1,4}$/);
  });
  it("refuses weak input and writes nothing", async () => {
    expect((await signup({ password: "short" })).error).toMatch(/at least 10/);
    expect((await signup({ email: "not-an-email" })).error).toMatch(/valid email/);
    expect((await signup({ companyName: "x" })).error).toMatch(/company/i);
    expect((await signup({ password: "qwertyuiop" })).error).toMatch(/easy to guess/);
    expect(await count("users")).toBe(0);
    expect(await count("companies")).toBe(0);
  });
  it("silently refuses bots that fill the honeypot", async () => {
    const r = await acct.signupAction({}, fd({ fullName: "Bot", email: "bot@example.com", companyName: "Spam", password: "blue-Table-92!", website: "http://spam" }));
    expect(r.error).toBeTruthy();
    expect(await count("users")).toBe(0);
  });
  it("is closed when no invitation code is configured", async () => {
    delete process.env.SIGNUP_INVITE_CODE;
    expect((await signup()).error).toMatch(/by invitation only/);
    process.env.SIGNUP_INVITE_CODE = "   ";
    expect((await signup()).error).toMatch(/by invitation only/);
    expect(await count("users")).toBe(0);
    expect(await count("companies")).toBe(0);
  });
  it("refuses a wrong or missing code, logs the attempt and throttles guessing", async () => {
    expect((await signup({ inviteCode: "nope" })).error).toMatch(/not valid/);
    expect((await signup({ inviteCode: "" })).error).toMatch(/not valid/);
    expect(await count("users")).toBe(0);
    expect(await count("companies")).toBe(0);
    expect(await attempts()).toBe(2);
    for (let i = 0; i < 8; i++) await signup({ inviteCode: `guess${i}` });
    expect((await signup({ inviteCode: "guess-x" })).error).toMatch(/Too many/);
  });
  it("refuses even the correct code once the attempt limit is reached", async () => {
    for (let i = 0; i < 10; i++) await signup({ inviteCode: `guess${i}` });
    expect((await signup()).error).toMatch(/Too many/);
    expect(await count("users")).toBe(0);
    expect(await count("companies")).toBe(0);
  });
  it("fails closed when the client address is unknown, even with the right code", async () => {
    h.state.ip = null;
    expect((await signup()).error).toMatch(/Too many/);
    expect(await count("users")).toBe(0);
  });
  it("caps attempts across all addresses, even with the right code", async () => {
    for (let i = 0; i < 40; i++)
      await client.query(`insert into audit_logs (action, details) values ('auth.signup_attempt', $1)`, [JSON.stringify({ ip: `9.9.9.${i}` })]);
    h.state.ip = "8.8.8.8";
    expect((await signup()).error).toMatch(/Too many/);
    expect(await count("users")).toBe(0);
  });
  it("does not let one address use up the ceiling for everyone else", async () => {
    for (let i = 0; i < 100; i++) await client.query(`insert into audit_logs (action, details) values ('auth.signup_attempt', $1)`, [JSON.stringify({ ip: "6.6.6.6" })]);
    h.state.ip = "8.8.8.8";
    expect(await redirected(signup())).toBe("/dashboard");
  });
  it("treats a code shorter than 16 characters as not configured", async () => {
    process.env.SIGNUP_INVITE_CODE = "short";
    expect((await signup({ inviteCode: "short" })).error).toMatch(/by invitation only/);
    expect(await count("users")).toBe(0);
  });
  it("accepts the code with surrounding spaces", async () => {
    expect(await redirected(signup({ inviteCode: `  ${INVITE} ` }))).toBe("/dashboard");
  });
  it("limits sign-ups per network address", async () => {
    for (let i = 0; i < 5; i++) await redirected(signup({ email: `u${i}@example.com`, companyName: `Co ${i}` }));
    const r = await signup({ email: "u6@example.com", companyName: "Co 6" });
    expect(r.error).toMatch(/Too many/);
    expect(await count("users")).toBe(5);
    h.state.ip = "2.2.2.2";
    expect(await redirected(signup({ email: "other@example.com", companyName: "Other" }))).toBe("/dashboard");
  });
});

describe("sign in after sign up", () => {
  it("accepts the right password and rejects the wrong one", async () => {
    await redirected(signup());
    h.jar.clear();
    expect((await auth.loginAction({}, fd({ email: "Shadi@example.com", password: "wrong-password" }))).error).toBe("invalid");
    expect(await redirected(auth.loginAction({}, fd({ email: "shadi@example.com", password: "blue-Table-92!" })))).toBe("/dashboard");
    expect((await currentUser.getCurrentUser())?.email).toBe("shadi@example.com");
  });
  it("locks an address after repeated failures", async () => {
    await redirected(signup());
    h.jar.clear();
    for (let i = 0; i < 5; i++) await auth.loginAction({}, fd({ email: "shadi@example.com", password: "nope-nope-nope" }));
    expect((await auth.loginAction({}, fd({ email: "shadi@example.com", password: "blue-Table-92!" }))).error).toBe("locked");
  });
});

describe("forgot and reset password", () => {
  const request = async (email = "shadi@example.com") => {
    const r = await acct.requestResetAction({}, fd({ email }));
    await flush();
    return r;
  };
  const tokenFromMail = () => /token=([A-Za-z0-9_-]+)/.exec(h.state.sent.at(-1)!.text)![1]!;

  it("emails a one-time link, storing only the token hash", async () => {
    await redirected(signup());
    expect((await request()).status).toBe("sent");
    expect(h.state.sent).toHaveLength(1);
    expect(h.state.sent[0]!.to).toBe("shadi@example.com");
    const token = tokenFromMail();
    const [row] = await db.select().from(schema.passwordResets);
    expect(row!.tokenHash).not.toBe(token);
    expect(row!.tokenHash).toHaveLength(64);
    expect(h.state.sent[0]!.text).toContain("https://app.test/reset-password?token=");
  });
  it("gives the same answer for an unknown email and sends nothing", async () => {
    await redirected(signup());
    expect((await request("nobody@example.com")).status).toBe("sent");
    expect(h.state.sent).toHaveLength(0);
    expect(await count("password_resets")).toBe(0);
  });
  it("says so when email is not configured", async () => {
    h.state.mailOn = false;
    expect((await request()).status).toBe("notConfigured");
  });
  it("limits reset requests per email", async () => {
    await redirected(signup());
    for (let i = 0; i < 5; i++) await request();
    expect(h.state.sent).toHaveLength(3);
  });
  it("resets the password once, kills older sessions, and keeps new sign-ins working", async () => {
    await redirected(signup());
    const oldSession = h.jar.get("sadaf_session")!;
    expect((await currentUser.getCurrentUser())?.email).toBe("shadi@example.com");
    await request();
    const token = tokenFromMail();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 5_000);
    expect(await redirected(acct.resetPasswordAction({}, fd({ token, password: "green-Chair-77!", confirm: "green-Chair-77!" })))).toBe("/login?reset=1");

    // the session from before the reset no longer works
    h.jar.set("sadaf_session", oldSession);
    expect(await currentUser.getCurrentUser()).toBeNull();
    // old password fails, new one works
    h.jar.clear();
    expect((await auth.loginAction({}, fd({ email: "shadi@example.com", password: "blue-Table-92!" }))).error).toBe("invalid");
    expect(await redirected(auth.loginAction({}, fd({ email: "shadi@example.com", password: "green-Chair-77!" })))).toBe("/dashboard");
    expect((await currentUser.getCurrentUser())?.email).toBe("shadi@example.com");
    // the link cannot be used twice
    expect((await acct.resetPasswordAction({}, fd({ token, password: "third-Pass-123!", confirm: "third-Pass-123!" }))).error).toMatch(/invalid or has expired/);
  });
  it("rejects mismatched, weak, expired and made-up tokens", async () => {
    await redirected(signup());
    await request();
    const token = tokenFromMail();
    expect((await acct.resetPasswordAction({}, fd({ token, password: "green-Chair-77!", confirm: "different-Pass-1" }))).error).toMatch(/do not match/);
    expect((await acct.resetPasswordAction({}, fd({ token, password: "short", confirm: "short" }))).error).toMatch(/at least 10/);
    expect((await acct.resetPasswordAction({}, fd({ token: "made-up", password: "green-Chair-77!", confirm: "green-Chair-77!" }))).error).toMatch(/invalid or has expired/);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 3_600_000);
    expect((await acct.resetPasswordAction({}, fd({ token, password: "green-Chair-77!", confirm: "green-Chair-77!" }))).error).toMatch(/invalid or has expired/);
  });
  it("a new reset request cancels older unused links once one is used", async () => {
    await redirected(signup());
    await request();
    const first = tokenFromMail();
    await request();
    const second = tokenFromMail();
    await redirected(acct.resetPasswordAction({}, fd({ token: second, password: "green-Chair-77!", confirm: "green-Chair-77!" })));
    expect((await acct.resetPasswordAction({}, fd({ token: first, password: "other-Pass-123!", confirm: "other-Pass-123!" }))).error).toMatch(/invalid or has expired/);
  });
});

describe("accounts and tenancy", () => {
  it("emails are unique regardless of case at the database level", async () => {
    await redirected(signup());
    const [c] = await db.select().from(schema.companies);
    await expect(db.insert(schema.users).values({ companyId: c!.id, email: "SHADI@EXAMPLE.COM", passwordHash: "x", fullName: "Dup" })).rejects.toThrow();
  });
  it("two companies stay separate", async () => {
    await redirected(signup());
    h.jar.clear();
    await redirected(signup({ email: "other@example.com", companyName: "Other Co" }));
    const me = await currentUser.getCurrentUser();
    expect(me?.companyName).toBe("Other Co");
    const users = await db.select().from(schema.users);
    expect(new Set(users.map((u) => u.companyId)).size).toBe(2);
  });
  it("bootstrap owner is created once and only on an empty database", async () => {
    Object.assign(process.env, {
      BOOTSTRAP_OWNER_EMAIL: "boss@example.com",
      BOOTSTRAP_OWNER_NAME: "Boss",
      BOOTSTRAP_OWNER_PASSWORD: "long-enough-pass-1",
      BOOTSTRAP_COMPANY_SLUG: "sadaf",
      BOOTSTRAP_COMPANY_NAME: "Sadaf Medical",
    });
    try {
      await bootstrap.ensureBootstrapOwner();
      expect(await count("users")).toBe(1);
      expect(await count("companies")).toBe(1);
      await client.exec("truncate audit_logs, password_resets, users, companies cascade");
      await redirected(signup());
      vi.resetModules();
      const fresh = await import("@/server/bootstrap-owner");
      await fresh.ensureBootstrapOwner();
      expect(await count("users")).toBe(1); // a non-empty database is never touched
    } finally {
      for (const k of ["EMAIL", "NAME", "PASSWORD"]) delete process.env[`BOOTSTRAP_OWNER_${k}`];
      for (const k of ["SLUG", "NAME"]) delete process.env[`BOOTSTRAP_COMPANY_${k}`];
    }
  });
});
