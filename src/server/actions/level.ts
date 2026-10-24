"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { LEVEL_COOKIE, parseLevel } from "@/core/level";

const YEAR = 60 * 60 * 24 * 365;

/** Only these places may be opened right after switching, so the form cannot be used to send a person elsewhere. */
const JUMPS = new Set(["/dashboard", "/settings/compare"]);

/** Remembers the chosen version for this browser. `jump` (optional, from a fixed list) is where to go next; otherwise the person stays on the page. */
export async function setLevelAction(fd: FormData): Promise<void> {
  const level = parseLevel(fd.get("level"));
  (await cookies()).set(LEVEL_COOKIE, level, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  const jump = String(fd.get("jump") ?? "");
  if (JUMPS.has(jump)) redirect(jump);
  refresh();
}
