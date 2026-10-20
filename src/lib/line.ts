import "server-only";
import { cookies } from "next/headers";
import { LINE_COOKIE, parseLine } from "@/core/line-filter";
import type { Line } from "@/core/sales-by-line";

/** The business line the person chose with the filter, or null for every line. */
export async function currentLine(): Promise<Line | null> {
  return parseLine((await cookies()).get(LINE_COOKIE)?.value);
}
