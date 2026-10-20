import "server-only";
import { cookies } from "next/headers";
import { LEVEL_COOKIE, parseLevel, type Level } from "@/core/level";

/** The version (Basic or Advanced) the person chose; Advanced until they choose. */
export async function currentLevel(): Promise<Level> {
  return parseLevel((await cookies()).get(LEVEL_COOKIE)?.value);
}
