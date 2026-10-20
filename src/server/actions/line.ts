"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { LINE_COOKIE, parseLine } from "@/core/line-filter";

const YEAR = 60 * 60 * 24 * 365;

/** Remembers the chosen business line for this browser; "All lines" (or anything unknown) clears it. */
export async function setLineAction(fd: FormData): Promise<void> {
  const line = parseLine(fd.get("line"));
  const jar = await cookies();
  if (line === null) jar.delete(LINE_COOKIE);
  else jar.set(LINE_COOKIE, line, { path: "/", maxAge: YEAR, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
  refresh();
}
